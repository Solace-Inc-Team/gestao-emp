"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { escolherFilialAction } from "@/app/actions";
import { useSaida } from "./saida";

type Filial = { id: string; name: string };

/**
 * Troca de filial do dono, no alto do menu: a empresa e a filial que ele está vendo num botão só, e um menu
 * com as filiais ao clicar. A filial nova aparece no botão na hora; enquanto o sistema troca os números,
 * o nome dela pulsa de leve, para a mudança das telas ter uma causa à vista.
 */
export function SeletorFilial({ empresa, atual, filiais }: { empresa: string; atual: string; filiais: Filial[] }) {
  const path = usePathname();
  const [aberto, setAberto] = useState(false);
  const [trocando, iniciar] = useTransition();
  const [mostrada, mostrar] = useOptimistic(atual);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const itens = useRef<(HTMLElement | null)[]>([]);
  const menuId = useId();
  const nome = filiais.find((f) => f.id === mostrada)?.name ?? "";
  const menu = useSaida(aberto);

  // clique fora fecha, como qualquer menu
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  // ao abrir, o foco vai para a filial atual (teclado continua dali)
  useEffect(() => {
    if (aberto) itens.current[Math.max(0, filiais.findIndex((f) => f.id === mostrada))]?.focus();
  }, [aberto, filiais, mostrada]);

  const fechar = (devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  };

  const escolher = (id: string) => {
    fechar();
    if (id === mostrada) return;
    iniciar(async () => {
      mostrar(id);
      const fd = new FormData();
      fd.set("branchId", id);
      await escolherFilialAction(fd);
    });
  };

  const navegar = (e: React.KeyboardEvent) => {
    const i = itens.current.findIndex((el) => el === document.activeElement);
    const total = filiais.length + 1;
    const ir = (n: number) => {
      e.preventDefault();
      itens.current[(n + total) % total]?.focus();
    };
    if (e.key === "ArrowDown") ir(i + 1);
    else if (e.key === "ArrowUp") ir(i - 1);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(total - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    } else if (e.key === "Tab") fechar(false);
  };

  return (
    <div ref={raiz} className="relative">
      <button
        ref={botao}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={menuId}
        aria-busy={trocando}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !aberto) {
            e.preventDefault();
            setAberto(true);
          }
        }}
        className="seletor-filial group flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left hover:bg-subtle aria-expanded:bg-subtle"
      >
        {/* inicial da filial: dá um rosto a cada uma e muda junto quando troca */}
        <span aria-hidden="true" key={mostrada} className="filial-inicial grid size-7 shrink-0 place-items-center rounded-md bg-marca/15 text-[12px] font-semibold text-marca">
          {nome.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[11.5px] text-muted">{empresa}</span>
          <span className={`block truncate text-[13px] font-medium ${trocando ? "filial-trocando" : ""}`}>{nome}</span>
        </span>
        <ChevronsUpDown aria-hidden="true" size={14} strokeWidth={1.75} className="shrink-0 text-muted transition-colors group-hover:text-fg" />
      </button>

      {menu.montado && (
        <div
          id={menuId}
          role="menu"
          data-saindo={menu.saindo || undefined}
          aria-label="Filiais"
          onKeyDown={navegar}
          className="popover popover-left absolute top-full right-0 left-0 z-30 mt-1.5 rounded-lg border border-line bg-surface p-1 shadow-[0_12px_32px_rgb(0_0_0/0.18)]"
        >
          <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] text-muted">Filiais</p>
          {filiais.map((f, i) => {
            const essa = f.id === mostrada;
            return (
              <button
                key={f.id}
                ref={(el) => {
                  itens.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={essa}
                tabIndex={-1}
                onClick={() => escolher(f.id)}
                className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] outline-none hover:bg-subtle focus-visible:bg-subtle"
              >
                <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded bg-subtle text-[10.5px] font-semibold text-muted">
                  {f.name.charAt(0).toUpperCase()}
                </span>
                <span className={`min-w-0 flex-1 truncate ${essa ? "font-medium" : ""}`}>{f.name}</span>
                {essa && <Check aria-hidden="true" size={14} strokeWidth={2} className="shrink-0 text-marca" />}
              </button>
            );
          })}
          <div className="my-1 border-t border-line" />
          <Link
            href={`${path}?config=filiais`}
            ref={(el) => {
              itens.current[filiais.length] = el;
            }}
            role="menuitem"
            tabIndex={-1}
            onClick={() => fechar(false)}
            className="flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted outline-none hover:bg-subtle hover:text-fg focus-visible:bg-subtle"
          >
            <Settings2 aria-hidden="true" size={14} strokeWidth={1.75} className="mx-[3px] shrink-0" />
            Gerenciar filiais
          </Link>
        </div>
      )}
    </div>
  );
}
