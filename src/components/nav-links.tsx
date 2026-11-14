"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  LayoutGrid,
  Plus,
  ReceiptText,
  Truck,
  Settings,
  Wallet,
  Package,
  Users,
  BarChart3,
  Tag,
  UserCog,
  HandCoins,
  History,
  CircleHelp,
  Receipt,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "/": LayoutGrid,
  "/pedidos/novo": Plus,
  "/pedidos": ReceiptText,
  "/entregas": Truck,
  "/configuracoes": Settings,
  "/caixa": Wallet,
  "/estoque": Package,
  "/clientes": Users,
  "/fiado": HandCoins,
  "/relatorios": BarChart3,
  "/despesas": Receipt,
  "/produtos": Tag,
  "/equipe": UserCog,
  "/auditoria": History,
  "/ajuda": CircleHelp,
};

export type NavGroup = { title?: string; links: { href: string; label: string }[] };

export function NavLinks({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : href === "/pedidos" ? /^\/pedidos(\/(?!novo).*)?$/.test(path) : path.startsWith(href);

  // no celular o menu rola de lado: a página atual vai para o centro e a borda esmaece onde ainda há itens
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const bordas = () => {
      el.toggleAttribute("data-mais-esq", el.scrollLeft > 4);
      el.toggleAttribute("data-mais-dir", el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
      // no computador, com a janela baixa, o menu rola para baixo: mesma ideia, em cima e embaixo
      el.toggleAttribute("data-mais-cima", el.scrollTop > 4);
      el.toggleAttribute("data-mais-baixo", el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    };
    if (el.scrollWidth > el.clientWidth) {
      const atual = el.querySelector<HTMLElement>("[aria-current=page]");
      if (atual) el.scrollTo({ left: atual.offsetLeft - (el.clientWidth - atual.offsetWidth) / 2, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    bordas();
    el.addEventListener("scroll", bordas, { passive: true });
    window.addEventListener("resize", bordas);
    return () => {
      el.removeEventListener("scroll", bordas);
      window.removeEventListener("resize", bordas);
    };
  }, [path]);

  return (
    <nav ref={nav} aria-label="Principal" className="nav-rola relative flex gap-1 overflow-x-auto px-3 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-5 lg:overflow-x-visible lg:overflow-y-auto lg:pb-4 lg:[scrollbar-width:thin]">
      {groups.map((g, i) => (
        <div key={i} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
          {g.title && <p className="hidden px-2 pb-1 text-xs font-medium text-muted lg:block">{g.title}</p>}
          {g.links.map((l) => {
            const Icon = icons[l.href];
            const on = active(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 shrink-0 items-center gap-2.5 lg:h-8 rounded-md px-2 text-[13px] font-medium transition-colors ${
                  on ? "bg-subtle text-fg" : "text-muted hover:bg-subtle/70 hover:text-fg"
                }`}
              >
                {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
                {l.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
