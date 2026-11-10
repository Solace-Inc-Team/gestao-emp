import { createHash } from "node:crypto";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Caminho sem query (pode ter nome de cliente numa busca) e com ids trocados por :id. */
export const cleanPath = (path: string) => path.split("?")[0].replace(UUID, ":id");

export function describeError(err: unknown) {
  if (err instanceof Error) {
    const digest = (err as Error & { digest?: string }).digest;
    return { message: scrub(err.message || err.name), stack: scrub(err.stack ?? "").slice(0, 2000), digest };
  }
  return { message: scrub(String(err)), stack: "", digest: undefined };
}

// o Drizzle põe os valores da consulta depois de "params:" (hash de senha, nome, telefone): nada disso é guardado
const scrub = (text: string) => redact(text.replace(/params:.*$/gm, "params: [omitidos]").replace(/scrypt\$\S+/g, "[hash]"));

/**
 * Mesma falha = mesma assinatura, mesmo que mude o id do pedido ou um número na mensagem:
 * mensagem normalizada + primeira linha útil do stack + rota.
 */
export function fingerprint(message: string, stack: string, path: string) {
  const msg = message.replace(UUID, ":id").replace(/\d+/g, "N");
  const frame = stack.split("\n").find((l) => l.trim().startsWith("at ")) ?? "";
  return createHash("sha1").update(`${msg}|${frame.trim().replace(/:\d+:\d+\)?$/, "")}|${cleanPath(path)}`).digest("hex").slice(0, 20);
}

/** Erros de controle do Next (redirect, notFound) não são falhas. */
export const isControlFlow = (digest?: string) => !!digest && /^NEXT_(REDIRECT|HTTP_ERROR_FALLBACK|NOT_FOUND)/.test(digest);

/** Tira do texto de alerta o que pode ser dado pessoal: e-mails e sequências longas de dígitos (telefone, documento). */
export const redact = (text: string) =>
  text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail]").replace(/\(?\d[\d\s().-]{7,}\d/g, "[número]");
