import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cofre para segredos de terceiros guardados no banco (token do Mercado Pago de cada empresa).
// AES-256-GCM com a chave SEGREDO_CHAVE (32 bytes em base64); um backup do banco sozinho não revela o token.

function chave() {
  const k = Buffer.from(process.env.SEGREDO_CHAVE ?? "", "base64");
  if (k.length !== 32) throw new Error("SEGREDO_CHAVE ausente ou inválida: gere com `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"`.");
  return k;
}

export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), dados.toString("base64")].join(":");
}

export function decifrar(guardado: string) {
  const [v, iv, tag, dados] = guardado.split(":");
  if (v !== "v1" || !iv || !tag || !dados) throw new Error("Segredo em formato desconhecido.");
  const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(dados, "base64")), d.final()]).toString("utf8");
}
