"use client";

import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

const money = { style: "currency", currency: "BRL" } as const;

/**
 * Número que rola como contador quando muda. `fromZero` faz a primeira exibição contar a partir de zero
 * (painel). Quem pediu menos movimento no aparelho vê o número trocar direto.
 */
export function LiveNumber({
  value,
  cents = false,
  fromZero = false,
  className = "",
}: {
  value: number;
  cents?: boolean;
  fromZero?: boolean;
  className?: string;
}) {
  // começa no zero e, no quadro seguinte, vai para o valor real: é isso que faz rolar ao abrir
  const [ready, setReady] = useState(!fromZero);
  useEffect(() => {
    if (ready) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [ready]);
  const shown = ready ? value : 0;
  return (
    <NumberFlow
      value={cents ? shown / 100 : shown}
      locales="pt-BR"
      format={cents ? money : undefined}
      className={`num ${className}`}
    />
  );
}
