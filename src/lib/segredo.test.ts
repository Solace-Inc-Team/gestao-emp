import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { cifrar, decifrar } from "./segredo.ts";

process.env.SEGREDO_CHAVE = randomBytes(32).toString("base64");

test("cofre: o token volta igual, não aparece no texto guardado e cada cifra é diferente", () => {
  const token = "APP_USR-1234567890-abcdefghijklmnop";
  const a = cifrar(token);
  assert.equal(decifrar(a), token);
  assert.ok(!a.includes(token));
  assert.notEqual(cifrar(token), a);
});

test("cofre: texto adulterado ou chave trocada não abre", () => {
  const a = cifrar("APP_USR-segredo");
  const [v, iv, tag, dados] = a.split(":");
  const outro = Buffer.from(dados, "base64");
  outro[0] ^= 1;
  assert.throws(() => decifrar([v, iv, tag, outro.toString("base64")].join(":")));
  process.env.SEGREDO_CHAVE = randomBytes(32).toString("base64");
  assert.throws(() => decifrar(a));
  process.env.SEGREDO_CHAVE = "curta";
  assert.throws(() => cifrar("x"), /SEGREDO_CHAVE/);
});
