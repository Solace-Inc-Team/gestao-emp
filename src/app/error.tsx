"use client";

import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

// erro inesperado numa página: o servidor já registrou e avisou a Solace
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <TriangleAlert size={28} strokeWidth={1.5} className="text-warn" aria-hidden="true" />
      <h1 className="h1 mt-4">Algo deu errado</h1>
      <p className="mt-2 text-muted">
        Esta tela não carregou. A equipe da Solace já foi avisada. Tente de novo; se continuar, use outra tela e volte mais tarde.
      </p>
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="btn btn-primary">
          <RotateCw size={15} strokeWidth={2} aria-hidden="true" />
          Tentar de novo
        </button>
        <Link href="/" className="btn">Ir para o início</Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-muted">Código do erro: {error.digest}</p>}
    </main>
  );
}
