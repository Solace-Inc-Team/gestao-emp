"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

// No celular o filtro fica recolhido para os números do dia aparecerem primeiro;
// no computador ele está sempre à vista. Começa aberto quando já há filtro aplicado.
export function FiltroPainel({ ativo, children, acao }: { ativo: boolean; children: ReactNode; acao: ReactNode }) {
  const [aberto, setAberto] = useState(ativo);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <button
        type="button"
        className="btn sm:hidden"
        aria-expanded={aberto}
        aria-controls="filtro-painel"
        onClick={() => setAberto((a) => !a)}
      >
        <SlidersHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />
        {ativo ? "Filtrado" : "Filtrar"}
      </button>
      {acao}
      <form
        id="filtro-painel"
        aria-label="Filtrar o painel"
        className={`${aberto ? "flex" : "hidden"} order-last w-full flex-wrap items-end gap-2 sm:order-first sm:flex sm:w-auto`}
      >
        {children}
      </form>
    </div>
  );
}
