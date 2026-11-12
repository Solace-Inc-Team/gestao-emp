import { useSyncExternalStore } from "react";
import "./palco.css";

// o que as demos da página inicial têm em comum

const consulta = "(prefers-color-scheme: dark)";
const assinar = (fn: () => void) => {
  const m = matchMedia(consulta);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

/** O tema do palco acompanha o claro/escuro do aparelho, como o resto da página. */
export const useEscuro = () => useSyncExternalStore(assinar, () => matchMedia(consulta).matches, () => false);

export const brl = (c: number) => `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
