"use client";

import { Printer } from "lucide-react";

// o navegador gera o PDF pela própria tela de impressão ("Salvar como PDF")
export function PrintButton({ label = "Imprimir ou salvar em PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>
      <Printer size={16} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </button>
  );
}
