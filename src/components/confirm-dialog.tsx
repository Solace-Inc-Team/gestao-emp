"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";

const EVENTO = "deposito:confirmar";

type Pedido = { texto: string; rotulo?: string; perigo?: boolean; responder: (ok: boolean) => void };

/**
 * Pergunta antes de uma ação sem volta, numa janela do próprio sistema (no lugar do confirm() do navegador).
 * `rotulo` é o texto do botão que foi clicado; `perigo` deixa o botão vermelho e o foco em "Voltar".
 */
export const confirmar = (texto: string, opcoes: { rotulo?: string; perigo?: boolean } = {}) =>
  new Promise<boolean>((responder) => window.dispatchEvent(new CustomEvent<Pedido>(EVENTO, { detail: { texto, ...opcoes, responder } })));

// "Contado R$ 10, esperado R$ 10: bateu. Fechar o acerto? Depois não dá para mudar." vira
// título "Fechar o acerto?" e o resto como explicação
// (só quebra frase em . ? ! seguido de espaço e maiúscula, para não partir "R$ 1.234,00")
function partes(texto: string) {
  const frases = texto.split(/(?<=[.?!])\s+(?=[A-ZÀ-Ú])/);
  const i = frases.findIndex((f) => f.endsWith("?"));
  if (i < 0) return { titulo: texto, detalhe: "" };
  return { titulo: frases[i], detalhe: frases.filter((_, k) => k !== i).join(" ") };
}

/** Fica no layout raiz e atende os pedidos de confirmação de qualquer tela. */
export function Confirmador() {
  const ref = useRef<HTMLDialogElement>(null);
  const [pedido, setPedido] = useState<Pedido>();
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const abrir = (e: Event) => {
      setSaindo(false);
      setPedido((e as CustomEvent<Pedido>).detail);
    };
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  useEffect(() => {
    if (pedido && !ref.current?.open) ref.current?.showModal();
  }, [pedido]);

  // responde, toca a saída e só então fecha de verdade
  const fechar = (ok: boolean) => {
    if (!pedido || saindo) return;
    pedido.responder(ok);
    setSaindo(true);
    const dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 170;
    setTimeout(() => {
      ref.current?.close();
      setPedido(undefined);
      setSaindo(false);
    }, dur);
  };

  const { titulo, detalhe } = partes(pedido?.texto ?? "");
  return (
    <dialog
      ref={ref}
      className="janela"
      data-saindo={saindo || undefined}
      aria-labelledby="janela-titulo"
      aria-describedby={detalhe ? "janela-detalhe" : undefined}
      onCancel={(e) => {
        e.preventDefault();
        fechar(false);
      }}
      onClick={(e) => {
        // clique fora do cartão (no fundo escurecido) é o mesmo que voltar
        if (e.target === e.currentTarget) fechar(false);
      }}
    >
      {pedido && (
        <div className="janela-cartao">
          <div className="flex gap-3">
            {pedido.perigo && (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
                <CircleAlert size={18} strokeWidth={2} aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h2 id="janela-titulo" className="text-[17px] leading-snug font-semibold tracking-tight">
                {titulo}
              </h2>
              {detalhe && (
                <p id="janela-detalhe" className="mt-1.5 text-muted">
                  {detalhe}
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn" autoFocus={pedido.perigo} onClick={() => fechar(false)}>
              Voltar
            </button>
            <button
              type="button"
              className={`btn ${pedido.perigo ? "btn-perigo" : "btn-primary"}`}
              autoFocus={!pedido.perigo}
              onClick={() => fechar(true)}
            >
              {pedido.rotulo || "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
