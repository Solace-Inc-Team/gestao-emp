"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { useSaida } from "@/components/saida";

// No celular o filtro fica recolhido para os números do dia aparecerem primeiro;
// no computador ele está sempre à vista. Começa aberto quando já há filtro aplicado.
// Escolher o dia ou o entregador já aplica: sem botão "Ver" e sem recarregar a página.
export function FiltroPainel({ ativo, children, acao }: { ativo: boolean; children: ReactNode; acao: ReactNode }) {
  const [aberto, setAberto] = useState(ativo);
  const filtro = useSaida(aberto);
  const router = useRouter();
  const [, iniciar] = useTransition();
  const aplicar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // o padrão fica fora do endereço: "Todos" (vazio) e o dia de hoje (o máximo do campo de data)
    const busca = new URLSearchParams();
    for (const campo of Array.from(e.currentTarget.elements) as HTMLInputElement[])
      if (campo.name && campo.value && campo.value !== campo.max) busca.set(campo.name, campo.value);
    iniciar(() => router.replace(busca.size ? `/?${busca}` : "/", { scroll: false }));
  };
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
        onSubmit={aplicar}
        onChange={(e) => e.currentTarget.requestSubmit()}
        aria-label="Filtrar o painel"
        data-saindo={filtro.saindo || undefined}
        className={`filtro-painel ${filtro.montado ? "flex" : "hidden"} order-last w-full flex-wrap items-end gap-2 sm:order-first sm:flex sm:w-auto`}
      >
        {children}
      </form>
    </div>
  );
}
