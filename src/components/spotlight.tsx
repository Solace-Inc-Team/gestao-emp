"use client";

import { useRef, type ReactNode } from "react";

/**
 * Passa a posição do ponteiro para o CSS (--mx/--my): no próprio bloco e em cada `.glow-card` dentro dele,
 * relativa ao cartão. O CSS desenha o holofote; aqui só se mede, uma vez por quadro.
 */
export function Spotlight({ as: Tag = "div", className, children }: { as?: "div" | "section"; className?: string; children: ReactNode }) {
  const frame = useRef(0);
  return (
    <Tag
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || frame.current) return;
        const el = e.currentTarget;
        const { clientX: x, clientY: y } = e;
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          const r = el.getBoundingClientRect();
          el.style.setProperty("--mx", `${x - r.left}px`);
          el.style.setProperty("--my", `${y - r.top}px`);
          el.querySelectorAll<HTMLElement>(".glow-card").forEach((c) => {
            const cr = c.getBoundingClientRect();
            c.style.setProperty("--mx", `${x - cr.left}px`);
            c.style.setProperty("--my", `${y - cr.top}px`);
          });
        });
      }}
    >
      {children}
    </Tag>
  );
}
