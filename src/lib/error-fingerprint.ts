import { createHash } from "node:crypto";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Caminho sem query (pode ter nome de cliente numa busca) e com ids trocados por :id. */
export const cleanPath = (path: string) => path.split("?")[0].replace(UUID, ":id");

export function describeError(err: unknown) {
  if (err instanceof Error) {
    const digest = (err as Error & { digest?: string }).digest;
    return { message: err.message || err.name, stack: (err.stack ?? "").slice(0, 2000), digest };
  }
  return { message: String(err), stack: "", digest: undefined };
}

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
