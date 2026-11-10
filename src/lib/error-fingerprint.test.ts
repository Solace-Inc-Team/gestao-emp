import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPath, describeError, fingerprint, isControlFlow, redact } from "./error-fingerprint.ts";

test("caminho perde a busca e os ids", () => {
  assert.equal(cleanPath("/pedidos/3e0bd8e0-4d24-4469-a223-b2a857d53536?q=Ana"), "/pedidos/:id");
  assert.equal(cleanPath("/caixa"), "/caixa");
});

test("mesma falha em pedidos diferentes tem a mesma assinatura", () => {
  const stack = "Error: x\n    at loadOrder (src/domain/orders.ts:40:11)\n    at other";
  const a = fingerprint("Pedido 12 falhou", stack, "/pedidos/3e0bd8e0-4d24-4469-a223-b2a857d53536");
  const b = fingerprint("Pedido 97 falhou", stack, "/pedidos/11111111-2222-3333-4444-555555555555");
  assert.equal(a, b);
  assert.notEqual(a, fingerprint("Outra coisa", stack, "/pedidos/:id"));
  assert.notEqual(a, fingerprint("Pedido 12 falhou", stack, "/caixa"));
});

test("redirect e notFound não contam como erro", () => {
  assert.ok(isControlFlow("NEXT_REDIRECT;replace;/login;307;"));
  assert.ok(isControlFlow("NEXT_HTTP_ERROR_FALLBACK;404"));
  assert.ok(!isControlFlow("1234567890"));
  assert.ok(!isControlFlow(undefined));
});

test("descreve erro e valor qualquer", () => {
  assert.equal(describeError(new Error("boom")).message, "boom");
  assert.equal(describeError("texto").message, "texto");
});

test("alerta não leva e-mail nem telefone", () => {
  const msg = 'duplicate key (email)=(maria.silva@gmail.com) telefone (11) 98811-2034 pedido 42';
  assert.equal(redact(msg), "duplicate key (email)=([e-mail]) telefone [número] pedido 42");
});

test("erro de consulta não guarda os valores", () => {
  const err = new Error('Failed query: update "users" set "password_hash" = $1 where "id" = $2\nparams: scrypt$16384$abc,ana@x.com');
  const { message, stack } = describeError(err);
  assert.equal(message, 'Failed query: update "users" set "password_hash" = $1 where "id" = $2\nparams: [omitidos]');
  assert.ok(!stack.includes("scrypt$") && !stack.includes("ana@x.com"));
});
