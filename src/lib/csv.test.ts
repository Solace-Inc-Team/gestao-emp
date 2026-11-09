import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, reais, toCsv } from "./csv.ts";

test("escapa separador, aspas e quebra de linha", () => {
  assert.equal(csvCell("a;b"), '"a;b"');
  assert.equal(csvCell('diz "oi"'), '"diz ""oi"""');
  assert.equal(csvCell("linha\nnova"), '"linha\nnova"');
  assert.equal(csvCell(null), "");
});

test("neutraliza fórmula de planilha", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("-1+2"), "'-1+2");
  // valor negativo continua número no Excel
  assert.equal(csvCell("-20,00"), "-20,00");
});

test("datas saem no horário de Brasília", () => {
  assert.equal(csvCell(new Date("2026-11-10T01:30:00Z")), "09/11/2026, 22:30");
});

test("valores em reais e cabeçalho com BOM", () => {
  assert.equal(reais(1250), "12,50");
  assert.equal(reais(null), "");
  assert.equal(toCsv(["a", "b"], [[1, "x"]]), "﻿a;b\r\n1;x");
});
