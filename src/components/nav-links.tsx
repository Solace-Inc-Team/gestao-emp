"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : href === "/pedidos" ? path === "/pedidos" || /^\/pedidos\/(?!novo)/.test(path) : path.startsWith(href);
  return (
    <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-col lg:px-3 lg:pb-4">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active(l.href) ? "page" : undefined}
          className={`shrink-0 rounded-md px-3 py-2 font-medium ${
            active(l.href) ? "bg-water-soft text-water" : "text-ink-soft hover:bg-paper hover:text-ink"
          } ${l.href === "/pedidos/novo" ? "lg:mb-2 lg:border lg:border-water/30" : ""}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
