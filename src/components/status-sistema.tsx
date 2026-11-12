"use client";

import { useEffect, useState } from "react";

// Status de verdade no rodapé: pergunta à rota de saúde (app e banco respondendo) em vez de afirmar.
// Enquanto não sabe, diz que está conferindo; se a rota falhar, avisa sem alarde.

type Estado = "conferindo" | "ok" | "fora";

const texto: Record<Estado, string> = {
  conferindo: "Conferindo o sistema",
  ok: "Sistema funcionando",
  fora: "Sistema com instabilidade agora",
};

export function StatusSistema() {
  const [estado, setEstado] = useState<Estado>("conferindo");
  useEffect(() => {
    const parar = new AbortController();
    fetch("/api/health", { cache: "no-store", signal: parar.signal })
      .then((r) => setEstado(r.ok ? "ok" : "fora"))
      .catch(() => {
        if (!parar.signal.aborted) setEstado("fora");
      });
    return () => parar.abort();
  }, []);
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full transition-colors duration-500 ${
          estado === "ok" ? "status-vivo bg-ok" : estado === "fora" ? "bg-warn" : "bg-line"
        }`}
      />
      {texto[estado]}
    </span>
  );
}
