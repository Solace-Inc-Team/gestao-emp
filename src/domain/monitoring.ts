import { desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { errorEvents } from "@/db/schema";
import { DomainError } from "@/lib/ctx";
import { cleanPath, describeError, fingerprint, isControlFlow, redact } from "@/lib/error-fingerprint";
import type { SessionUser } from "@/lib/auth";

export type SendAlert = (text: string) => Promise<void>;

/** Mesmo erro avisa no máximo uma vez por hora (ou de novo se tinha sido marcado como resolvido). */
export const ALERT_EVERY_MS = 60 * 60 * 1000;

/** Telegram: ALERT_TELEGRAM_BOT_TOKEN + ALERT_TELEGRAM_CHAT_ID. Sem as duas, não avisa. */
export const telegramAlert: SendAlert = async (text) => {
  const token = process.env.ALERT_TELEGRAM_BOT_TOKEN;
  const chat = process.env.ALERT_TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Telegram respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

export const alertsConfigured = () => !!(process.env.ALERT_TELEGRAM_BOT_TOKEN && process.env.ALERT_TELEGRAM_CHAT_ID);

export async function sendTestAlert(admin: SessionUser) {
  if (!admin.platformAdmin) throw new DomainError("Sem permissão.");
  if (!alertsConfigured()) throw new DomainError("Configure ALERT_TELEGRAM_BOT_TOKEN e ALERT_TELEGRAM_CHAT_ID no servidor.");
  try {
    await telegramAlert(`Teste de alerta do Depósito, enviado por ${admin.email}. Se chegou, os avisos de erro estão funcionando.`);
  } catch (e) {
    throw new DomainError(`O Telegram recusou: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Registra um erro do servidor e decide se avisa. Nunca lança: monitoramento
 * quebrado não pode derrubar a requisição que já falhou.
 */
export async function recordError(
  err: unknown,
  req: { path: string; method: string; kind: string },
  send: SendAlert = telegramAlert,
  now = new Date(),
) {
  try {
    const { message, stack, digest } = describeError(err);
    if (isControlFlow(digest)) return { recorded: false, alerted: false };
    const path = cleanPath(req.path);
    const fp = fingerprint(message, stack, path);

    const { alert, count } = await db.transaction(async (tx) => {
      await tx
        .insert(errorEvents)
        .values({ fingerprint: fp, message, stack, path, method: req.method, kind: req.kind, count: 0, firstSeen: now, lastSeen: now })
        .onConflictDoNothing();
      const [row] = await tx.select().from(errorEvents).where(eq(errorEvents.fingerprint, fp)).for("update");
      const alert = row.count === 0 || row.resolvedAt !== null || !row.lastAlertAt || now.getTime() - row.lastAlertAt.getTime() >= ALERT_EVERY_MS;
      await tx
        .update(errorEvents)
        .set({
          count: sql`${errorEvents.count} + 1`,
          lastSeen: now,
          message,
          stack,
          resolvedAt: null,
          ...(alert ? { lastAlertAt: now } : {}),
        })
        .where(eq(errorEvents.id, row.id));
      return { alert, count: row.count + 1 };
    });
    // a política de privacidade promete apagar registros técnicos de erro após 12 meses
    await db.delete(errorEvents).where(lt(errorEvents.lastSeen, new Date(now.getTime() - 365 * 864e5)));

    if (alert) {
      const env = process.env.NODE_ENV === "production" ? "" : " (desenvolvimento)";
      await send(`Erro no Depósito${env}\n${redact(message).slice(0, 300)}\n${req.method} ${path}\nOcorrências: ${count}`).catch((e) =>
        console.error("[monitor] falha ao enviar alerta:", e),
      );
    }
    return { recorded: true, alerted: alert };
  } catch (e) {
    console.error("[monitor] falha ao registrar erro:", e);
    return { recorded: false, alerted: false };
  }
}

export async function listErrors(admin: SessionUser) {
  if (!admin.platformAdmin) throw new DomainError("Sem permissão.");
  return db
    .select()
    .from(errorEvents)
    .orderBy(sql`${errorEvents.resolvedAt} is not null`, desc(errorEvents.lastSeen))
    .limit(200);
}

export async function resolveError(admin: SessionUser, id: string) {
  if (!admin.platformAdmin) throw new DomainError("Sem permissão.");
  const [e] = await db.update(errorEvents).set({ resolvedAt: new Date() }).where(eq(errorEvents.id, id)).returning({ id: errorEvents.id });
  if (!e) throw new DomainError("Erro não encontrado.");
}
