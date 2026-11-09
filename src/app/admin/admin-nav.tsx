"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ openErrors }: { openErrors: number }) {
  const path = usePathname();
  const item = (href: string, label: string, badge?: number) => {
    const on = href === "/admin" ? path === "/admin" : path.startsWith(href);
    return (
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium ${on ? "bg-subtle text-fg" : "text-muted hover:text-fg"}`}
      >
        {label}
        {!!badge && <span className="num rounded-full bg-danger px-1.5 text-[11px] leading-4 text-white">{badge}</span>}
      </Link>
    );
  };
  return (
    <nav aria-label="Painel da Solace" className="flex gap-1">
      {item("/admin", "Empresas")}
      {item("/admin/erros", "Erros", openErrors)}
    </nav>
  );
}
