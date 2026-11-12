import { test } from "node:test";
import assert from "node:assert/strict";
import { comparar } from "./comparativo.ts";

test("sobe e desce em porcentagem arredondada", () => {
  assert.deepEqual(comparar(11200, 10000, "andamento"), { texto: "+12% que ontem até agora", tom: "sobe" });
  assert.deepEqual(comparar(9150, 10000, "fechado"), { texto: "−9% que o dia anterior", tom: "desce" });
});

test("diferença que arredonda para zero conta como igual", () => {
  assert.deepEqual(comparar(10040, 10000, "andamento"), { texto: "igual a ontem até agora", tom: "igual" });
});

test("sem venda no dia anterior não vira porcentagem infinita", () => {
  assert.deepEqual(comparar(5000, 0, "fechado"), { texto: "o dia anterior não teve venda", tom: "sobe" });
  assert.deepEqual(comparar(5000, 0, "andamento"), { texto: "ontem não tinha venda a esta hora", tom: "sobe" });
  assert.equal(comparar(0, 0, "fechado"), null);
});
