"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { aplicar, lerEscolha, temaEscuro, type Escolha } from "@/lib/tema";

const ordem: Escolha[] = ["auto", "claro", "escuro"];
const info = {
  auto: { icone: Monitor, texto: "Tema automático, igual ao do aparelho" },
  claro: { icone: Sun, texto: "Tema claro" },
  escuro: { icone: Moon, texto: "Tema escuro" },
};

/** Um botão que alterna automático, claro e escuro. O título diz o atual; o clique passa ao próximo. */
export function TemaBotao({ className = "" }: { className?: string }) {
  // no servidor é "auto"; no navegador lê a escolha guardada e acompanha qualquer troca de tema
  const escolha = useSyncExternalStore(temaEscuro.assinar, lerEscolha, () => "auto" as Escolha);
  const { icone: Icone, texto } = info[escolha];
  const proxima = ordem[(ordem.indexOf(escolha) + 1) % ordem.length];
  return (
    <button
      type="button"
      title={`${texto}. Clique para ${info[proxima].texto.toLowerCase()}.`}
      aria-label={`${texto}. Trocar tema`}
      onClick={() => aplicar(proxima)}
      className={`grid place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg ${className}`}
    >
      <Icone size={15} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
