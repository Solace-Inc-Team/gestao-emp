"use client";

import { useEffect, useState, type ReactNode } from "react";

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

/**
 * Bloco que aparece no lugar e some recolhendo (campo de troco, aviso de estoque, campos da entrega).
 * Abre crescendo a altura, fecha encolhendo e só então sai da página; fechado, o campo não vai no formulário.
 */
export function Aparece({ quando, children, className = "" }: { quando: boolean; children: ReactNode; className?: string }) {
  const { montado, saindo } = useSaida(quando, 200);
  if (!montado) return null;
  return (
    <div className="recolhe" data-aberto={!saindo || undefined} inert={saindo || undefined}>
      {/* o espaçamento fica um nível abaixo do que encolhe: fechado, a altura chega a zero */}
      <div>
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}
