"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Enquanto o pedido não termina, a página busca a situação de novo a cada 20 segundos, só com a aba
 * à vista; ao voltar para a aba, atualiza na hora. Pedido entregue ou cancelado não precisa mais.
 */
export function AtualizaSozinho({ ativo }: { ativo: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!ativo) return;
    const busca = () => !document.hidden && router.refresh();
    const id = setInterval(busca, 20_000);
    document.addEventListener("visibilitychange", busca);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", busca);
    };
  }, [ativo, router]);
  return null;
}
