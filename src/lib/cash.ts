export type ShiftOrder = {
  status: "aberto" | "em_rota" | "entregue" | "cancelado" | "estornado";
  paymentMethod: "dinheiro" | "pix" | "cartao" | "fiado";
  totalCents: number;
};

/**
 * Dinheiro que o entregador deve ter em mãos: troco inicial + vendas em dinheiro
 * - o que já repassou ao caixa - o que gastou com autorização.
 */
export function expectedCash(openingCashCents: number, orders: ShiftOrder[], handedOverCents = 0): number {
  return (
    orders
      .filter((o) => o.status === "entregue" && o.paymentMethod === "dinheiro")
      .reduce((sum, o) => sum + o.totalCents, openingCashCents) - handedOverCents
  );
}

export function paymentSummary(orders: ShiftOrder[]) {
  const sum = { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 };
  for (const o of orders) if (o.status === "entregue") sum[o.paymentMethod] += o.totalCents;
  return sum;
}

// positivo = sobra, negativo = falta
export const cashDifference = (expectedCents: number, countedCents: number) => countedCents - expectedCents;

export function orderTotal(items: { quantity: number; unitPriceCents: number }[], deliveryFeeCents: number) {
  return items.reduce((s, i) => s + i.quantity * i.unitPriceCents, deliveryFeeCents);
}
