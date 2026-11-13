import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { branches, sessions, users, tenants } from "@/db/schema";
import type { Ctx, Role } from "./ctx";
import { TERMS_VERSION } from "./legal";

const COOKIE = "sessao";
/** filial que o dono escolheu ver; a equipe ignora, fica sempre na sua */
export const FILIAL_COOKIE = "filial";
const TTL_MS = 1000 * 60 * 60 * 12;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string, mfaPending = false) {
  const token = randomBytes(32).toString("base64url");
  // enquanto espera o código, a sessão vale só 10 minutos
  const expiresAt = new Date(Date.now() + (mfaPending ? 10 * 60 * 1000 : TTL_MS));
  await db.insert(sessions).values({ id: sha(token), userId, expiresAt, mfaPending });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha(token)));
  jar.delete(COOKIE);
}

export type SessionUser = Ctx & {
  name: string;
  email: string;
  tenantName: string;
  platformAdmin: boolean;
  totpEnabled: boolean;
  termsVersion: string | null;
  branchName: string;
  /** filiais ativas da empresa, a principal primeiro; com uma só, nada de filial aparece na tela */
  branches: { id: string; name: string }[];
};

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      userId: users.id,
      tenantId: users.tenantId,
      role: users.role,
      name: users.name,
      email: users.email,
      tenantName: tenants.name,
      platformAdmin: users.platformAdmin,
      totpEnabled: users.totpEnabled,
      termsVersion: users.termsVersion,
      ownBranch: users.branchId,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(
      and(
        eq(sessions.id, sha(token)),
        gt(sessions.expiresAt, new Date()),
        eq(sessions.mfaPending, false),
        eq(users.active, true),
        eq(tenants.active, true),
      ),
    );
  if (!row) return null;
  const { ownBranch, ...user } = row;
  const list = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(eq(branches.tenantId, row.tenantId), eq(branches.active, true)))
    .orderBy(desc(branches.main), asc(branches.name));
  const escolhida = row.role === "dono" ? (await cookies()).get(FILIAL_COOKIE)?.value : ownBranch;
  const atual = list.find((b) => b.id === escolhida) ?? list[0];
  return { ...user, branchId: atual.id, branchName: atual.name, branches: list };
});

/** Sessão que já passou pela senha e espera o código de 2FA. */
export async function getPendingMfa() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ sessionId: sessions.id, userId: users.id, role: users.role, platformAdmin: users.platformAdmin, secret: users.totpSecret })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha(token)), gt(sessions.expiresAt, new Date()), eq(sessions.mfaPending, true)));
  return row ?? null;
}

// código conferido: troca a sessão provisória por uma normal (token novo, evita fixação de sessão)
export async function completeMfa(sessionId: string, userId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  await createSession(userId);
}

/** Dono que ainda não aceitou a versão atual dos termos: só pode ver o aceite e sair. */
export const pendingTerms = (u: SessionUser) => u.role === "dono" && !u.platformAdmin && u.termsVersion !== TERMS_VERSION;

export async function requireUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (pendingTerms(user)) redirect("/aceite");
  if (roles.length && !roles.includes(user.role)) redirect(user.role === "entregador" ? "/entregador" : "/");
  return user;
}

// 404 em vez de redirect: quem não é da Solace nem fica sabendo que a página existe
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getUser();
  if (!user?.platformAdmin) notFound();
  return user;
}
