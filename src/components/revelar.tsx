import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Botão que abre um formulário logo abaixo: para ações que não são o caminho normal
 * (entrega parcial, estorno, apagar dados). O formulário só aparece quando alguém pede.
 * É um <details> nativo, então funciona sem JavaScript e com teclado.
 */
export function Revelar({ label, perigo = false, children }: { label: string; perigo?: boolean; children: ReactNode }) {
  return (
    <details>
      <summary className={`desvio btn w-full ${perigo ? "text-danger" : ""}`}>
        {label}
        <ChevronDown size={15} strokeWidth={1.75} aria-hidden="true" className="desvio-seta" />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
