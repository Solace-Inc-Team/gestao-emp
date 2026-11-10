export type ShiftOrder = {
  status: "aberto" | "em_rota" | "entregue" | "cancelado" | "estornado";
  paymentMethod: "dinheiro" | "pix" | "cartao" | "fiado";
  totalCents: number;
  cashPartCents?: number;
};

/** Quanto do pedido foi pago em dinheiro (tudo, ou só a parte em dinheiro de um pagamento misto). */
export const cashOf = (o: ShiftOrder) => (o.paymentMethod === "dinheiro" ? o.totalCents : (o.cashPartCents ?? 0));

/**
 * Dinheiro que o entregador deve ter em mãos: troco inicial + vendas em dinheiro
 * - o que já repassou ao caixa - o que gastou com autorização.
 */
export function expectedCash(openingCashCents: number, orders: ShiftOrder[], handedOverCents = 0): number {
  return (
    orders.filter((o) => o.status === "entregue").reduce((sum, o) => sum + cashOf(o), openingCashCents) - handedOverCents
  );
}

export function paymentSummary(orders: ShiftOrder[]) {
  const sum = { dinheiro: 0, pix: 0, cartao: 0, fiado: 0 };
  for (const o of orders) {
    if (o.status !== "entregue") continue;
    sum.dinheiro += cashOf(o);
    if (o.paymentMethod !== "dinheiro") sum[o.paymentMethod] += o.totalCents - cashOf(o);
  }
  return sum;
}

// positivo = sobra, negativo = falta
export const cashDifference = (expectedCents: number, countedCents: number) => countedCents - expectedCents;

export const itemsSubtotal = (items: { quantity: number; unitPriceCents: number }[]) =>
  items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);

export function orderTotal(items: { quantity: number; unitPriceCents: number }[], deliveryFeeCents: number, discountCents = 0) {
  return itemsSubtotal(items) + deliveryFeeCents - discountCents;
}
