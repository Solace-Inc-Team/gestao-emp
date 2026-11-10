"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
};

export type NavGroup = { title?: string; links: { href: string; label: string }[] };

export function NavLinks({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : href === "/pedidos" ? /^\/pedidos(\/(?!novo).*)?$/.test(path) : path.startsWith(href);

  return (
    <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-4">
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
