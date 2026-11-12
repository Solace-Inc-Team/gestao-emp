import { useSyncExternalStore } from "react";
import { temaEscuro } from "@/lib/tema";
import "./palco.css";

// o que as demos da página inicial têm em comum

/** O tema do palco acompanha o da página: a escolha da pessoa ou, no automático, o do aparelho. */
export const useEscuro = () => useSyncExternalStore(temaEscuro.assinar, temaEscuro.agora, () => false);

export const brl = (c: number) => `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
