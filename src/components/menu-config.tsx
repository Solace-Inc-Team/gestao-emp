"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { CONFIGURACOES, naConfiguracao } from "./config-nav";
import { useSaida } from "./saida";

/**
 * Engrenagem do dono, no alto do menu: abre a lista de tudo que é configuração (regras, pagamentos, site,
 * filiais, produtos, equipe, auditoria), que antes ocupava quatro linhas do menu. Abre e fecha com movimento;
 * setas, Esc e clique fora funcionam como em qualquer menu.
 */
export function MenuConfig({ className = "" }: { className?: string }) {
  const path = usePathname();
  const [aberto, setAberto] = useState(false);
  const menu = useSaida(aberto);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const itens = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuId = useId();
  const ativo = naConfiguracao(path);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  useEffect(() => {
    if (aberto) itens.current[Math.max(0, CONFIGURACOES.findIndex((c) => c.href === path))]?.focus();
  }, [aberto, path]);

  const navegar = (e: React.KeyboardEvent) => {
    const i = itens.current.findIndex((el) => el === document.activeElement);
    const n = CONFIGURACOES.length;
    const ir = (k: number) => {
      e.preventDefault();
      itens.current[(k + n) % n]?.focus();
    };
    if (e.key === "ArrowDown") ir(i + 1);
    else if (e.key === "ArrowUp") ir(i - 1);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(n - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
      botao.current?.focus();
    } else if (e.key === "Tab") setAberto(false);
  };

  return (
    <div ref={raiz} className="relative">
      <button
        ref={botao}
        type="button"
        aria-label="Configurações"
        title="Configurações"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={menuId}
        onClick={() => setAberto((a) => !a)}
        className={`menu-config grid place-items-center rounded-md hover:bg-subtle hover:text-fg aria-expanded:bg-subtle aria-expanded:text-fg ${ativo ? "bg-subtle text-fg" : "text-muted"} ${className}`}
      >
        <Settings size={16} strokeWidth={1.75} aria-hidden="true" className="engrenagem" />
      </button>
      {menu.montado && (
        <div
          id={menuId}
          role="menu"
          aria-label="Configurações"
          onKeyDown={navegar}
          data-saindo={menu.saindo || undefined}
          // no celular a engrenagem fica na ponta direita: abre para a esquerda; no computador, para a direita (sobre a tela)
          className="popover menu-config-lista absolute top-full right-0 z-30 mt-1.5 w-64 lg:right-auto lg:left-0 rounded-lg border border-line bg-surface p-1 shadow-[0_12px_32px_rgb(0_0_0/0.18)]"
        >
          <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] text-muted">Configurações</p>
          {CONFIGURACOES.map((c, i) => (
            <Link
              key={c.href}
              href={c.href}
              ref={(el) => {
                itens.current[i] = el;
              }}
              role="menuitem"
              tabIndex={-1}
              aria-current={path === c.href ? "page" : undefined}
              onClick={() => setAberto(false)}
              className="block rounded-md px-2.5 py-1.5 outline-none hover:bg-subtle focus-visible:bg-subtle aria-[current=page]:bg-subtle"
            >
              <span className="block text-[13px] font-medium">{c.label}</span>
              <span className="block text-[12px] text-muted">{c.desc}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
