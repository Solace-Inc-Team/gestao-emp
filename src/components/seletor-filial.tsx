"use client";

import { useTransition } from "react";
import { escolherFilialAction } from "@/app/actions";

// Só aparece para o dono com mais de uma filial: escolher já troca o sistema inteiro para ela.
// Enquanto a troca chega, o menu fica esmaecido, para a mudança dos números ter uma causa à vista.
export function SeletorFilial({ atual, filiais }: { atual: string; filiais: { id: string; name: string }[] }) {
  const [trocando, iniciar] = useTransition();
  return (
    <form action={(fd) => iniciar(() => escolherFilialAction(fd))}>
      <label htmlFor="filial-atual" className="sr-only">Filial</label>
      {/* key: depois da troca o React limpa o formulário; o campo volta já com a filial nova */}
      <select
        key={atual}
        id="filial-atual"
        name="branchId"
        defaultValue={atual}
        aria-busy={trocando}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`input h-9 py-0 text-[13px] font-medium transition-opacity duration-[var(--dur-fast)] ${trocando ? "opacity-60" : ""}`}
      >
        {filiais.map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
    </form>
  );
}
