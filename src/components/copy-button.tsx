"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label = "Copiar código" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn copiar"
      data-feito={done || undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          return; // sem permissão de copiar: o código continua na tela para copiar à mão
        }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {/* os dois ícones no mesmo lugar: o de copiar sai girando e o ✓ chega, e voltam depois */}
      <span aria-hidden="true" className="relative grid size-4 place-items-center">
        <Copy size={16} strokeWidth={1.75} className="copiar-icone copiar-de" />
        <Check size={16} strokeWidth={2} className="copiar-icone copiar-ok" />
      </span>
      {/* o texto troca com um esmaecer curto (a chave nova faz a palavra chegar) */}
      <span key={String(done)} className="copiar-texto">{done ? "Copiado" : label}</span>
    </button>
  );
}
