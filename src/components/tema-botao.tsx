"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { aplicar, lerEscolha, temaEscuro, type Escolha } from "@/lib/tema";

const ordem: Escolha[] = ["escuro", "claro", "auto"];
const info = {
  auto: { icone: Monitor, texto: "Tema automático, igual ao do aparelho" },
  claro: { icone: Sun, texto: "Tema claro" },
  escuro: { icone: Moon, texto: "Tema escuro" },
};

/** Um botão que alterna automático, claro e escuro. O título diz o atual; o clique passa ao próximo. */
export function TemaBotao({ className = "" }: { className?: string }) {
  // no servidor é o escuro padrão; no navegador lê a escolha guardada e acompanha qualquer troca de tema
  const escolha = useSyncExternalStore(temaEscuro.assinar, lerEscolha, () => "escuro" as Escolha);
  const proxima = ordem[(ordem.indexOf(escolha) + 1) % ordem.length];
  return (
    <button
      type="button"
      title={`${info[escolha].texto}. Clique para ${info[proxima].texto.toLowerCase()}.`}
      aria-label={`${info[escolha].texto}. Trocar tema`}
      onClick={(e) => {
        // o tema novo nasce do centro do ícone clicado
        const r = e.currentTarget.getBoundingClientRect();
        aplicar(proxima, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      className={`grid place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg ${className}`}
    >
      {/* os três ícones no mesmo lugar: o que sai gira e some, o que entra gira e aparece */}
      <span className="grid size-[15px] *:col-start-1 *:row-start-1" aria-hidden="true">
        {ordem.map((k) => {
          const Icone = info[k].icone;
          return <Icone key={k} size={15} strokeWidth={1.75} className="tema-icone" data-on={k === escolha || undefined} />;
        })}
      </span>
    </button>
  );
}
