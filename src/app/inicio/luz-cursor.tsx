"use client";

import { useRef, type ReactNode } from "react";

/**
 * Luz suave que acompanha o cursor dentro de cada peça do mosaico (.bento): a peça sob o mouse
 * recebe a posição em --luz-x/--luz-y e o CSS desenha o brilho ali. Sem mouse, nada acontece.
 */
export function LuzCursor({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const peca = (e.target as HTMLElement).closest<HTMLElement>(".bento");
        if (!peca) return;
        const r = peca.getBoundingClientRect();
        peca.style.setProperty("--luz-x", `${e.clientX - r.left}px`);
        peca.style.setProperty("--luz-y", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}
