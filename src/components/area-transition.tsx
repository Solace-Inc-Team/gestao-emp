"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// telas do sistema interno: entre elas quem anima é o PageTransition do layout, com a barra lateral parada
const APP = /^\/(pedidos|entregas|caixa|estoque|clientes|fiado|relatorios|despesas|produtos|equipe|configuracoes|fornecedores|auditoria)(\/|$)/;

const area = (path: string) => (path === "/" || APP.test(path) ? "app" : path.startsWith("/admin") ? "admin" : path);

/** Troca de tela entre áreas diferentes: página inicial, login, sistema, entregador, portal, termos. */
export function AreaTransition({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <ViewTransition key={area(path)} enter="page" exit="page" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
