import "server-only";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

/** true quando a chave (ex.: "login:fulano@x.com") já errou demais na janela. */
export async function isBlocked(key: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gte(loginAttempts.createdAt, new Date(Date.now() - WINDOW_MS))));
  return n >= MAX_FAILURES;
}

export async function recordFailure(key: string) {
  await db.insert(loginAttempts).values({ key });
  // limpeza oportunista do que já saiu da janela
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - WINDOW_MS)));
}

export const clearFailures = (key: string) => db.delete(loginAttempts).where(eq(loginAttempts.key, key));

export const BLOCKED_MESSAGE = "Muitas tentativas erradas. Espere 15 minutos e tente de novo.";
