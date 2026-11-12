"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { progress } from "./nav-progress";
import { confirmar } from "./confirm-dialog";

export type ActionState = { error?: string; ok?: string } | undefined | void;

const TOAST_EVENT = "deposito:toast";

// mensagem do sistema no lugar do balão do navegador ("Please fill out this field"), usando o rótulo do campo
type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
function avisoDoCampo(campo: Campo) {
  const rotulo = (campo.labels?.[0]?.textContent ?? campo.getAttribute("aria-label") ?? "")
    // tira o que vem entre parênteses no rótulo, como "(opcional)"
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim();
  const nome = rotulo ? `o campo "${rotulo}"` : "este campo";
  const v = campo.validity;
  if (v.valueMissing) return campo instanceof HTMLSelectElement ? `Escolha uma opção em ${nome}.` : `Preencha ${nome}.`;
  if (v.typeMismatch && campo.type === "email") return "Digite um e-mail válido, como nome@empresa.com.";
  if (v.tooShort && "minLength" in campo) return `Em ${nome}, use pelo menos ${campo.minLength} caracteres.`;
  if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch) return `O valor em ${nome} está fora do permitido.`;
  if (v.patternMismatch) return `Confira o formato em ${nome}.`;
  return `Confira ${nome}.`;
}

/** Primeiro campo inválido do formulário: marca, faz tremer, põe o foco e devolve a mensagem. Sem erro, null. */
export function validarCampos(form: HTMLFormElement): string | null {
  const campo = form.querySelector<Campo>(":invalid:not(fieldset)");
  if (!campo) return null;
  campo.setAttribute("aria-invalid", "true");
  campo.classList.remove("campo-treme");
  void campo.offsetWidth;
  campo.classList.add("campo-treme");
  campo.focus();
  campo.addEventListener("input", () => campo.removeAttribute("aria-invalid"), { once: true });
  // a mensagem de erro rola a tela até ela; depois disso a tela volta para o campo que falta
  setTimeout(() => campo.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
  return avisoDoCampo(campo);
}

export const toast = (message: string) => window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));

// onSubmit manual em vez de action={...}: o React limpa o form depois da action, e em caso de erro
// a gente quer manter o que foi digitado
export function ActionForm({
  action,
  children,
  className,
  reset = false,
  confirm,
}: {
  action: (fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  reset?: boolean;
  confirm?: string;
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // em formulário comprido o erro fica fora da tela: rola até ele
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  return (
    <form
      // se enviado antes do JS carregar, vai como POST: senha nunca aparece na URL
      method="post"
      // a validação dos campos é mostrada pelo próprio formulário (sem o balão do navegador); o servidor valida de novo
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        // o botão que enviou mostra que está esperando e depois o ✓ (estilos em globals.css)
        const button = (e.nativeEvent as SubmitEvent).submitter;
        // campo obrigatório vazio ou inválido: o campo treme e a mensagem sai em português, sem o balão do navegador
        const aviso = validarCampos(form);
        if (aviso) {
          setError(aviso);
          return;
        }
        // ação sem volta: pergunta na janela do sistema, com o nome do botão clicado no botão de confirmar
        if (
          confirm &&
          !(await confirmar(confirm, { rotulo: button?.textContent?.trim(), perigo: button?.classList.contains("btn-danger") }))
        )
          return;
        const fd = new FormData(form);
        button?.setAttribute("data-state", "loading");
        progress(true);
        start(async () => {
          let r: ActionState;
          try {
            r = await action(fd);
          } catch (e) {
            progress(false);
            button?.removeAttribute("data-state");
            // sem sinal o fetch da ação falha: mantém a tela e o que foi digitado em vez de cair na página de erro
            if (e instanceof TypeError || !navigator.onLine) {
              setError("Sem internet. Tente de novo quando o sinal voltar.");
              return;
            }
            throw e;
          }
          // se a ação trocou de tela a barra completa sozinha; se não, completa aqui
          progress(false);
          setError(r?.error);
          if (r?.error) {
            button?.removeAttribute("data-state");
            return;
          }
          button?.setAttribute("data-state", "done");
          setTimeout(() => button?.removeAttribute("data-state"), 1200);
          // o aviso fica fora do form: muitas ações trocam a tela e o form some junto
          if (r?.ok) toast(r.ok);
          const menu = form.closest("details");
          if (menu) menu.open = false;
          if (reset || menu) form.reset();
        });
      }}
    >
      {/* o fieldset recebe o layout (space-y, grid) para que o espaçamento chegue aos campos */}
      <fieldset disabled={pending} className={`min-w-0 ${className ?? ""}`}>
        {children}
        {error && (
          <p
            ref={errorRef}
            role="alert"
            className="col-span-full mt-2 flex basis-full items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger"
          >
            <CircleAlert size={16} strokeWidth={2} className="mt-px shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </fieldset>
    </form>
  );
}

/** Mostra os avisos de sucesso das ações. Fica no layout raiz. */
type Toast = { id: number; message: string; leaving?: boolean };

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    let seq = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const show = (e: Event) => {
      const id = ++seq;
      const message = (e as CustomEvent<string>).detail;
      // a mesma mensagem de novo (despachos seguidos) substitui a anterior em vez de empilhar
      setToasts((list) => [...list.filter((t) => t.message !== message).slice(-2), { id, message }]);
      // marca a saída, espera a animação e só então tira da lista
      later(3500, () => setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t))));
      later(3700, () => setToasts((list) => list.filter((t) => t.id !== id)));
    };
    window.addEventListener(TOAST_EVENT, show);
    return () => {
      window.removeEventListener(TOAST_EVENT, show);
      timers.forEach(clearTimeout);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto">
      {toasts.map((current) => (
        <p
          key={current.id}
          data-leaving={current.leaving || undefined}
          className="toast flex max-w-sm items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-[13px] font-medium shadow-[0_8px_30px_rgb(0_0_0/0.12)]"
        >
          <CircleCheck size={16} strokeWidth={2} className="text-ok" aria-hidden="true" />
          {current.message}
        </p>
      ))}
    </div>
  );
}
