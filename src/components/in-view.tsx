"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/** Vira true uma vez, quando o elemento entra na tela. Com `enabled` falso já começa true. */
export function useInView(ref: RefObject<Element | null>, enabled = true) {
  const [seen, setSeen] = useState(!enabled);
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setSeen(true);
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

/** Marca `data-inview` quando o bloco aparece; o CSS decide o que anima a partir disso. */
export function InView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  return (
    <div ref={ref} data-inview={seen} className={className}>
      {children}
    </div>
  );
}
