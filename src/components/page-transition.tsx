"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// a chave muda só quando a rota muda: atualizar a mesma tela não anima
export function PageTransition({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <ViewTransition key={path} enter="page" exit="page" default="none">
      {/* .pagina: o conteúdo entra em cascata (globals.css); como a chave é a rota, só anima ao trocar de tela */}
      <div className="pagina">{children}</div>
    </ViewTransition>
  );
}
