"use client";

import { useEffect, useState } from "react";

/**
 * Mantém na tela, por um instante, o que acabou de ser fechado, para a saída ser vista: `montado` diz se
 * ainda renderiza e `saindo` marca o elemento (data-saindo) enquanto o CSS toca a saída. Quem prefere menos
 * movimento não espera: some na hora.
 */
export function useSaida(visivel: boolean, ms = 140) {
  const [montado, setMontado] = useState(visivel);
  // abriu: monta já, durante a renderização (sem esperar um efeito)
  if (visivel && !montado) setMontado(true);
  const saindo = montado && !visivel;
  useEffect(() => {
    if (!saindo) return;
    const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setMontado(false), reduzir ? 0 : ms);
    return () => clearTimeout(t);
  }, [saindo, ms]);
  return { montado, saindo };
}
