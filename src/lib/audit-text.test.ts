import { test } from "node:test";
import assert from "node:assert/strict";
import { descrever } from "./audit-text.ts";

const limpo = (s: string) => s.replace(/\s/g, " ");

test("preço alterado mostra antes e depois, e ignora o que não mudou", () => {
  const l = descrever("produto.editar", {
    before: { name: "Gás P13", priceCents: 11000, minStock: 5, returnable: true, active: true, containerPriceCents: 0 },
    after: { name: "Gás P13", priceCents: 11500, minStock: 5, returnable: true, active: true, containerPriceCents: 0 },
  });
  assert.equal(l.titulo, "Alterou o produto Gás P13");
  assert.deepEqual(l.mudancas.map((m) => m.map(limpo)), [["Preço", "R$ 110,00", "R$ 115,00"]]);
});

test("ajuste de estoque traz quantidade anterior, contada e a diferença com sinal", () => {
  const l = descrever("estoque.ajuste", { state: "cheio", counted: 72, before: 75, delta: -3, reason: "quebra" }, {}, "Galão 20L");
  assert.equal(l.titulo, "Ajustou o estoque de Galão 20L");
  assert.deepEqual(l.mudancas, [["Cheios", "75", "72 (−3)"]]);
  assert.deepEqual(l.detalhes, ["Motivo: quebra"]);
});

test("acerto com falta e troca de entregador usam os nomes recebidos", () => {
  const a = descrever("turno.acerto", { expected: 3000, countedCashCents: 2500, diff: -500 }, {}, "Carlos");
  assert.equal(a.titulo, "Fechou o acerto de Carlos");
  assert.equal(limpo(a.detalhes[1]), "Falta de R$ 5,00");
  const t = descrever("pedido.trocar_entregador", { from: "u1", to: "u2" }, { u1: "João", u2: "Carlos" }, "#12");
  assert.deepEqual(t.mudancas, [["Entregador", "João", "Carlos"]]);
});

test("ação desconhecida não quebra a tela", () => {
  const l = descrever("algo.novo", null);
  assert.equal(l.titulo, "algo.novo");
  assert.deepEqual(l.detalhes, []);
});

test("quantidade no singular e no plural", () => {
  assert.deepEqual(descrever("estoque.avaria", { from: "vazio", quantity: 1, note: "trincado" }, {}, "Galão").detalhes, ["1 vazio", "trincado"]);
  assert.equal(descrever("estoque.compra", { full: 10 }, {}, "Gás P13").detalhes[0], "10 cheios");
});
