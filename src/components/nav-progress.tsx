"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export const PROGRESS_EVENT = "deposito:progresso";

/** Avisa a barra do topo que algo começou (`true`) ou terminou (`false`) sem trocar de endereço. */
export const progress = (on: boolean) => window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: on }));

/**
 * Barra fina no topo que responde ao clique na hora: sobe devagar enquanto a próxima tela não chega e
 * completa quando o endereço muda. No desenvolvimento o Next não pré-carrega as telas, então sem ela o
 * clique parece não ter feito nada por quase um segundo.
 */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const started = useRef(false);

  useEffect(() => {
    const start = () => {
      started.current = true;
      setState("loading");
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // só âncora na mesma página (#como-funciona) não é navegação
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    const onProgress = (e: Event) => {
      if ((e as CustomEvent<boolean>).detail) start();
      else if (started.current) setState("done");
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(PROGRESS_EVENT, onProgress);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(PROGRESS_EVENT, onProgress);
    };
  }, []);

  // endereço novo: a tela chegou
  useEffect(() => {
    if (!started.current) return;
    const id = requestAnimationFrame(() => setState("done"));
    return () => cancelAnimationFrame(id);
  }, [path, search]);

  useEffect(() => {
    if (state === "done") {
      started.current = false;
      const id = setTimeout(() => setState("idle"), 400);
      return () => clearTimeout(id);
    }
    // nada responde em 15 s (servidor fora do ar): some em vez de ficar parada
    if (state === "loading") {
      const id = setTimeout(() => setState("done"), 15000);
      return () => clearTimeout(id);
    }
  }, [state]);

  return <div aria-hidden="true" data-progress={state === "idle" ? undefined : state === "loading" ? "on" : "done"} className="nav-progress" />;
}
