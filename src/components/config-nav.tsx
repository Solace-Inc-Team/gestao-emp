"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition, useEffect, useRef } from "react";

// Tudo que é configuração do dono, num lugar só: a engrenagem do menu abre esta lista, e cada tela dela
// mostra as abas no alto para pular de uma para outra sem voltar ao menu.
export const CONFIGURACOES = [
  { href: "/configuracoes", label: "Regras da casa", desc: "Desconto da equipe e prazo de atraso" },
  { href: "/configuracoes/pagamentos", label: "Pagamentos", desc: "Chave Pix e Mercado Pago" },
  { href: "/configuracoes/site", label: "Pedidos pelo site", desc: "Link e QR para o cliente pedir" },
  { href: "/configuracoes/filiais", label: "Filiais", desc: "Lojas da empresa" },
  { href: "/produtos", label: "Produtos e preços", desc: "O que você vende e por quanto" },
  { href: "/equipe", label: "Equipe", desc: "Acessos, perfis e entregadores" },
  { href: "/auditoria", label: "Auditoria", desc: "Quem fez o quê e quando" },
] as const;

export const naConfiguracao = (path: string) => CONFIGURACOES.some((c) => path === c.href || (c.href !== "/configuracoes" && path.startsWith(c.href + "/")));

export function ConfigNav() {
  const path = usePathname();
  // no celular as abas rolam de lado: a atual vem para a vista e esmaece a borda que ainda tem abas
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const bordas = () => {
      el.toggleAttribute("data-mais-esq", el.scrollLeft > 4);
      el.toggleAttribute("data-mais-dir", el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    const atual = el.querySelector<HTMLElement>("[aria-current=page]");
    if (atual && el.scrollWidth > el.clientWidth) el.scrollLeft = atual.offsetLeft - (el.clientWidth - atual.offsetWidth) / 2;
    bordas();
    el.addEventListener("scroll", bordas, { passive: true });
    return () => el.removeEventListener("scroll", bordas);
  }, [path]);
  return (
    // as abas ficam paradas na troca de tela (mesmo nome dos dois lados); só a marca da aba ativa desliza
    <ViewTransition name="config-abas" share="morph" default="none">
      <nav ref={nav} aria-label="Configurações" className="nav-rola mb-6 -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
        {CONFIGURACOES.map((c) => {
          const on = path === c.href;
          return (
            <Link
              key={c.href}
              href={c.href}
              aria-current={on ? "page" : undefined}
              className={`relative shrink-0 px-2.5 pt-1 pb-3 text-[13px] font-medium whitespace-nowrap transition-colors ${on ? "text-fg" : "text-muted hover:text-fg"}`}
            >
              {c.label}
              {on && (
                <ViewTransition name="config-aba-ativa" share="move" default="none">
                  <span aria-hidden="true" className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-fg" />
                </ViewTransition>
              )}
            </Link>
          );
        })}
      </nav>
    </ViewTransition>
  );
}
