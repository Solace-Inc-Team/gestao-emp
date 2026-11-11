"use client";

import { useEffect, useRef, useState } from "react";
import NumberFlow from "@number-flow/react";
import { formatBRL } from "@/lib/money";
import { useInView } from "./in-view";

const money = { style: "currency", currency: "BRL" } as const;

// "once": só a primeira abertura conta do zero (os números que montam juntos nesse primeiro segundo);
// voltar ao painel mostra o valor direto, sem a pausa no zero contradizendo o resto da tela
let firstOpenAt = 0;
const isFirstOpen = () => {
  firstOpenAt ||= Date.now();
  return Date.now() - firstOpenAt < 1000;
};

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
  fromZero?: boolean | "visible" | "once";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, fromZero === "visible");
  // começa no zero e depois vai para o valor real: é isso que faz rolar ao abrir. Ao abrir a tela espera a
  // troca de tela terminar, senão as duas animações disputam o mesmo quadro em celular fraco
  const [ready, setReady] = useState(() => !fromZero || (fromZero === "once" && !isFirstOpen()));
  useEffect(() => {
    if (ready || !visible) return;
    const id = setTimeout(() => setReady(true), fromZero === "visible" ? 0 : 340);
    return () => clearTimeout(id);
  }, [ready, visible, fromZero]);
  const shown = ready ? value : 0;
  // contando do zero pode demorar; mudança de valor numa tela de trabalho tem que ser rápida, senão passa
  // por números errados no meio do caminho
  const timing = { duration: fromZero && !ready ? 700 : 250, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
  // o leitor de tela lê dígito por dígito o que está rolando; ele recebe só o valor final, em texto comum
  return (
    <span ref={ref} className={`inline-block ${className}`}>
      <NumberFlow aria-hidden="true" transformTiming={timing} spinTiming={timing} value={cents ? shown / 100 : shown} locales="pt-BR" format={cents ? money : undefined} className="num" />
      <span className="sr-only">{cents ? formatBRL(value) : value.toLocaleString("pt-BR")}</span>
    </span>
  );
}
