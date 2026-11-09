import { test } from "node:test";
import assert from "node:assert/strict";
import { expectedCash, paymentSummary, cashDifference, orderTotal } from "./cash.ts";
import { parseBRL } from "./money.ts";

const orders = [
  { status: "entregue", paymentMethod: "dinheiro", totalCents: 11000 },
  { status: "entregue", paymentMethod: "pix", totalCents: 1400 },
  { status: "cancelado", paymentMethod: "dinheiro", totalCents: 11000 },
  { status: "em_rota", paymentMethod: "dinheiro", totalCents: 2800 },
  { status: "entregue", paymentMethod: "dinheiro", totalCents: 1400 },
] as const;

test("dinheiro esperado conta só entregas em dinheiro + troco inicial", () => {
  assert.equal(expectedCash(5000, [...orders]), 5000 + 11000 + 1400);
});

test("resumo por forma de pagamento ignora não entregues", () => {
  assert.deepEqual(paymentSummary([...orders]), { dinheiro: 12400, pix: 1400, cartao: 0, fiado: 0 });
});

test("diferença: falta é negativa, sobra é positiva", () => {
  assert.equal(cashDifference(17400, 15400), -2000);
  assert.equal(cashDifference(17400, 17500), 100);
});

test("total do pedido inclui taxa de entrega", () => {
  assert.equal(orderTotal([{ quantity: 2, unitPriceCents: 1400 }], 300), 3100);
});

test("parseBRL aceita formatos brasileiros e rejeita lixo", () => {
  assert.equal(parseBRL("1.234,56"), 123456);
  assert.equal(parseBRL("R$ 12,5"), 1250);
  assert.equal(parseBRL("110"), 11000);
  assert.equal(parseBRL("abc"), null);
  assert.equal(parseBRL("1,234"), null);
});
