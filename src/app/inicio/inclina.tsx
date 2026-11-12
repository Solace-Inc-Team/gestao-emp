"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Os vasilhames do topo inclinam de leve para o lado onde está o cursor, e a água dentro do galão
 * fica nivelada, como água de verdade. Ouve o movimento na seção inteira (a camada dos desenhos
 * não recebe clique). Só com mouse e sem pedido de menos movimento; ao sair, voltam ao prumo.
 */
export function Inclina({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const area = el?.parentElement;
    if (!el || !area) return;
    if (!matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let quadro = 0;
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const r = area.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 2 - 1;
        el.style.setProperty("--mx", Math.max(-1, Math.min(1, x)).toFixed(3));
      });
    };
    const sair = () => {
      cancelAnimationFrame(quadro);
      el.style.setProperty("--mx", "0");
    };
    area.addEventListener("pointermove", mover);
    area.addEventListener("pointerleave", sair);
    return () => {
      cancelAnimationFrame(quadro);
      area.removeEventListener("pointermove", mover);
      area.removeEventListener("pointerleave", sair);
    };
  }, []);
  return (
    <div ref={ref} aria-hidden="true" className={`inclina ${className}`}>
      {children}
    </div>
  );
}
