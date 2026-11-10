import { test } from "node:test";
import assert from "node:assert/strict";
import { crc16, pixPayload } from "./pix.ts";

test("CRC16-CCITT confere com o valor de referência", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("código Pix tem os campos certos e o CRC fecha", () => {
  const code = pixPayload({ key: "dono@fonteazul.com.br", name: "Distribuidora Fonte Azul", city: "São Paulo", amountCents: 11000, txid: "PED-42" });
  assert.ok(code.startsWith("000201"));
  assert.ok(code.includes("0014br.gov.bcb.pix0121dono@fonteazul.com.br"));
  assert.ok(code.includes("5406110.00"));
  assert.ok(code.includes("5924DISTRIBUIDORA FONTE AZUL"));
  assert.ok(code.includes("6009SAO PAULO"));
  assert.ok(code.includes("62090505PED42"));
  assert.equal(code.slice(-4), crc16(code.slice(0, -4)));
});
