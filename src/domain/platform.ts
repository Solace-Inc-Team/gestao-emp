import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, tenantDeletions, tenants, users } from "@/db/schema";
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

/** Endereço do portal: nome sem acento + sufixo aleatório, para não colidir nem ser adivinhado de outra empresa. */
export const slugFor = (name: string) =>
  `${name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30)}-${randomBytes(3).toString("hex")}`;

export async function createTenant(admin: SessionUser, input: z.infer<typeof newTenantSchema>) {
  assertAdmin(admin);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (taken) throw new DomainError("Já existe um usuário com este e-mail.");
    const [t] = await tx.insert(tenants).values({ name: input.company, slug: slugFor(input.company) }).returning();
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
    const [t] = await tx.update(tenants).set({ active, suspendedAt: active ? null : new Date() }).where(eq(tenants.id, tenantId)).returning({ id: tenants.id });
    if (!t) throw new DomainError("Empresa não encontrada.");
    await audit(tx, { tenantId, userId: admin.userId, role: "dono" }, active ? "empresa.reativar" : "empresa.suspender", "tenant", tenantId);
  });
}

/** Dono esqueceu a senha ou perdeu o celular do 2FA: senha nova e 2FA desligado. */
export async function resetOwnerAccess(admin: SessionUser, tenantId: string, password: string) {
  assertAdmin(admin);
  if (password.length < 8) throw new DomainError("A senha nova precisa de ao menos 8 caracteres.");
  const passwordHash = await hashPassword(password);
  return db.transaction(async (tx) => {
    const [owner] = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "dono")))
      .orderBy(users.createdAt)
      .limit(1);
    if (!owner) throw new DomainError("Empresa sem dono cadastrado.");
    await tx.update(users).set({ passwordHash, totpEnabled: false, totpSecret: null }).where(eq(users.id, owner.id));
    await tx.delete(sessions).where(eq(sessions.userId, owner.id));
    await audit(tx, { tenantId, userId: admin.userId, role: "dono" }, "empresa.redefinir_acesso_dono", "user", owner.id);
    return owner.email;
  });
}

/** Prazo da política de privacidade para apagar empresa cancelada. */
export const DELETE_DEADLINE_DAYS = 90;

/**
 * Apaga de vez todos os dados de uma empresa. Só empresa suspensa, com o nome digitado
 * para confirmar. Tudo numa transação: ou some tudo, ou nada muda.
 */
export async function deleteTenant(admin: SessionUser, tenantId: string, confirmName: string) {
  assertAdmin(admin);
  if (tenantId === admin.tenantId) throw new DomainError("A Solace não pode ser excluída.");
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).for("update");
    if (!t) throw new DomainError("Empresa não encontrada.");
    if (t.active) throw new DomainError("Suspenda a empresa antes de excluir.");
    if (confirmName.trim() !== t.name) throw new DomainError("Digite o nome exato da empresa para confirmar.");

    const counts: Record<string, number> = {};
    const del = async (label: string, q: ReturnType<typeof sql>) => {
      const r = await tx.execute(q);
      counts[label] = (r as unknown as { count: number }).count;
    };
    // ordem pensada nas chaves estrangeiras: primeiro o que aponta para os outros
    await del("historico", sql`delete from audit_log where tenant_id = ${t.id}`);
    await del("pagamentos_fiado", sql`delete from customer_payments where tenant_id = ${t.id}`);
    await del("lancamentos_de_caixa", sql`delete from cash_entries where tenant_id = ${t.id}`);
    await del("comodato", sql`delete from container_loans where tenant_id = ${t.id}`);
    await del("despesas", sql`delete from expenses where tenant_id = ${t.id}`);
    await del("movimentacoes_estoque", sql`delete from stock_movements where tenant_id = ${t.id}`);
    await del("itens_pedido", sql`delete from order_items where tenant_id = ${t.id}`);
    await del("pedidos", sql`delete from orders where tenant_id = ${t.id}`);
    await del("turnos", sql`delete from shifts where tenant_id = ${t.id}`);
    await del("enderecos", sql`delete from customer_addresses where tenant_id = ${t.id}`);
    await del("clientes", sql`delete from customers where tenant_id = ${t.id}`);
    await del("produtos", sql`delete from products where tenant_id = ${t.id}`);
    await del("fornecedores", sql`delete from suppliers where tenant_id = ${t.id}`);
    await del("sessoes", sql`delete from sessions where user_id in (select id from users where tenant_id = ${t.id})`);
    await del(
      "tentativas_login",
      sql`delete from login_attempts
        where key like any (select 'login:' || email || ':%' from users where tenant_id = ${t.id})
           or key in (select p || id::text from users cross join (values ('totp:'), ('senha:')) as k(p) where tenant_id = ${t.id})`,
    );
    await del("usuarios", sql`delete from users where tenant_id = ${t.id}`);
    await tx.delete(tenants).where(eq(tenants.id, t.id));
    await tx.insert(tenantDeletions).values({ tenantId: t.id, tenantName: t.name, deletedBy: admin.email, counts });
    return counts;
  });
}

export async function listDeletions(admin: SessionUser) {
  assertAdmin(admin);
  return db.select().from(tenantDeletions).orderBy(desc(tenantDeletions.deletedAt)).limit(50);
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
      suspendedAt: tenants.suspendedAt,
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
    const [t] = await tx.insert(tenants).values({ name: "Solace", slug: slugFor("Solace") }).returning();
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
