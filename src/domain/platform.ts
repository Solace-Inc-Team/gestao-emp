import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { DomainError } from "@/lib/ctx";
import { hashPassword } from "@/lib/password";
import type { SessionUser } from "@/lib/auth";
import { audit } from "./stock";

// Tudo aqui é da equipe da Solace e atravessa empresas, por isso não recebe Ctx de tenant.
function assertAdmin(admin: SessionUser) {
  if (!admin.platformAdmin) throw new DomainError("Sem permissão.");
}

export const newTenantSchema = z.object({
  company: z.string().trim().min(2, "Informe o nome da empresa.").max(120),
  ownerName: z.string().trim().min(2, "Informe o nome do dono.").max(80),
  email: z.email("E-mail inválido.").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "A senha inicial precisa de ao menos 8 caracteres."),
});

export async function createTenant(admin: SessionUser, input: z.infer<typeof newTenantSchema>) {
  assertAdmin(admin);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (taken) throw new DomainError("Já existe um usuário com este e-mail.");
    const [t] = await tx.insert(tenants).values({ name: input.company }).returning();
    const [owner] = await tx
      .insert(users)
      .values({ tenantId: t.id, name: input.ownerName, email: input.email, role: "dono", passwordHash })
      .returning({ id: users.id });
    await audit(tx, { tenantId: t.id, userId: admin.userId, role: "dono" }, "empresa.criar", "tenant", t.id, {
      ownerId: owner.id,
      email: input.email,
    });
    return t;
  });
}

export async function setTenantActive(admin: SessionUser, tenantId: string, active: boolean) {
  assertAdmin(admin);
  if (tenantId === admin.tenantId) throw new DomainError("Não dá pra suspender a própria Solace.");
  await db.transaction(async (tx) => {
    const [t] = await tx.update(tenants).set({ active }).where(eq(tenants.id, tenantId)).returning({ id: tenants.id });
    if (!t) throw new DomainError("Empresa não encontrada.");
    await audit(tx, { tenantId, userId: admin.userId, role: "dono" }, active ? "empresa.reativar" : "empresa.suspender", "tenant", tenantId);
  });
}

export async function listTenants(admin: SessionUser) {
  assertAdmin(admin);
  const since = new Date(Date.now() - 30 * 864e5);
  return db
    .select({
      id: tenants.id,
      name: tenants.name,
      active: tenants.active,
      createdAt: tenants.createdAt,
      // nomes qualificados à mão: dentro da subquery o drizzle solta só "id", que viraria users.id
      owner: sql<string | null>`(select u.email from users u where u.tenant_id = tenants.id and u.role = 'dono' order by u.created_at limit 1)`,
      people: sql<number>`(select count(*)::int from users u where u.tenant_id = tenants.id and u.active)`,
      orders30: sql<number>`(select count(*)::int from orders o where o.tenant_id = tenants.id and o.created_at >= ${since.toISOString()})`,
      lastOrder: sql<string | null>`(select max(o.created_at) from orders o where o.tenant_id = tenants.id)`,
    })
    .from(tenants)
    .where(sql`${tenants.id} <> ${admin.tenantId}`)
    .orderBy(desc(tenants.createdAt));
}

/** Cria a Solace e o primeiro admin a partir de ADMIN_EMAIL/ADMIN_PASSWORD, se ainda não existirem. */
export async function ensurePlatformAdmin(email: string, password: string) {
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
  if (exists) return false;
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const [t] = await tx.insert(tenants).values({ name: "Solace" }).returning();
    await tx.insert(users).values({
      tenantId: t.id,
      name: "Administrador Solace",
      email: email.toLowerCase(),
      role: "dono",
      passwordHash,
      platformAdmin: true,
    });
  });
  return true;
}
