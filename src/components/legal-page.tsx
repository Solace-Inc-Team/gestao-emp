import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { company, termsDate } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/login" aria-label="Ir para o login">
            <Logo />
          </Link>
          <nav className="flex gap-5 text-[13px] text-muted">
            <Link href="/termos" className="hover:text-fg">Termos de uso</Link>
            <Link href="/privacidade" className="hover:text-fg">Privacidade</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 text-muted">Versão de {termsDate}</p>
        <article className="legal mt-10">{children}</article>
        <p className="mt-16 border-t border-line pt-6 text-[13px] text-muted">
          {company.legalName}, CNPJ {company.cnpj}. Dúvidas: {company.email}.
        </p>
      </main>
    </div>
  );
}
