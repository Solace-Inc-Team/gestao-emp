"use client";

import { useEffect, useRef, useState } from "react";
import NumberFlow from "@number-flow/react";
import { formatBRL } from "@/lib/money";
import { useInView } from "./in-view";

const money = { style: "currency", currency: "BRL" } as const;

/**
 * Número que rola como contador quando muda. `fromZero` faz a primeira exibição contar a partir de zero:
 * ao abrir a tela (painel) ou, com "visible", quando o número aparece na rolagem (página inicial).
 * Quem pediu menos movimento no aparelho vê o número trocar direto.
 */
export function LiveNumber({
  value,
  cents = false,
  fromZero = false,
  className = "",
}: {
  value: number;
  cents?: boolean;
  fromZero?: boolean | "visible";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, fromZero === "visible");
  // começa no zero e, no quadro seguinte, vai para o valor real: é isso que faz rolar ao abrir
  const [ready, setReady] = useState(!fromZero);
  useEffect(() => {
    if (ready || !visible) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [ready, visible]);
  const shown = ready ? value : 0;
  // o leitor de tela lê dígito por dígito o que está rolando; ele recebe só o valor final, em texto comum
  return (
    <span ref={ref} className={`inline-block ${className}`}>
      <NumberFlow aria-hidden="true" value={cents ? shown / 100 : shown} locales="pt-BR" format={cents ? money : undefined} className="num" />
      <span className="sr-only">{cents ? formatBRL(value) : value.toLocaleString("pt-BR")}</span>
    </span>
  );
}
