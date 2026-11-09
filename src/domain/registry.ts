import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, products, sessions, users } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { hashPassword } from "@/lib/password";
import { audit } from "./stock";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(120),
  phone: z.string().trim().max(30),
  address: z.string().trim().max(200),
  reference: z.string().trim().max(200),
  notes: z.string().trim().max(500),
});

export async function saveCustomer(ctx: Ctx, input: z.infer<typeof customerSchema>, id?: string) {
  assertRole(ctx, "dono", "atendente");
  return db.transaction(async (tx) => {
    if (id) {
      const [c] = await tx
        .update(customers)
        .set(input)
        .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)))
        .returning();
      if (!c) throw new DomainError("Cliente não encontrado.");
      await audit(tx, ctx, "cliente.editar", "customer", c.id, input);
      return c;
    }
    const [c] = await tx.insert(customers).values({ ...input, tenantId: ctx.tenantId }).returning();
    await audit(tx, ctx, "cliente.criar", "customer", c.id);
    return c;
  });
}

export const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  priceCents: z.int().min(0).max(100_000_00),
  returnable: z.boolean(),
  minStock: z.int().min(0).max(100_000),
  active: z.boolean(),
});

export async function saveProduct(ctx: Ctx, input: z.infer<typeof productSchema>, id?: string) {
  assertRole(ctx, "dono");
  return db.transaction(async (tx) => {
    if (id) {
      const [before] = await tx
        .select()
        .from(products)
        .where(and(eq(products.id, id), eq(products.tenantId, ctx.tenantId)));
      if (!before) throw new DomainError("Produto não encontrado.");
      const [p] = await tx.update(products).set(input).where(eq(products.id, id)).returning();
      await audit(tx, ctx, "produto.editar", "product", p.id, { before, after: input });
      return p;
    }
    const [p] = await tx.insert(products).values({ ...input, tenantId: ctx.tenantId }).returning();
    await audit(tx, ctx, "produto.criar", "product", p.id, input);
    return p;
  });
}

export const userSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email("E-mail inválido.").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Senha precisa de ao menos 8 caracteres."),
  role: z.enum(["dono", "atendente", "entregador"]),
});

export async function createUser(ctx: Ctx, input: z.infer<typeof userSchema>) {
  assertRole(ctx, "dono");
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [exists] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (exists) throw new DomainError("Já existe um usuário com este e-mail.");
    const [u] = await tx
      .insert(users)
      .values({ tenantId: ctx.tenantId, name: input.name, email: input.email, role: input.role, passwordHash })
      .returning({ id: users.id });
    await audit(tx, ctx, "usuario.criar", "user", u.id, { email: input.email, role: input.role });
    return u;
  });
}

export async function resetUserPassword(ctx: Ctx, userId: string, password: string) {
  assertRole(ctx, "dono");
  if (userId === ctx.userId) throw new DomainError("Para trocar a sua própria senha, use a página Senha.");
  if (password.length < 8) throw new DomainError("A senha nova precisa de ao menos 8 caracteres.");
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const [u] = await tx
      .update(users)
      .set({ passwordHash })
      .where(and(eq(users.id, userId), eq(users.tenantId, ctx.tenantId)))
      .returning({ id: users.id });
    if (!u) throw new DomainError("Usuário não encontrado.");
    await tx.delete(sessions).where(eq(sessions.userId, u.id)); // derruba quem estava logado com a senha antiga
    await audit(tx, ctx, "usuario.redefinir_senha", "user", u.id);
  });
}

/** Aceite eletrônico dos termos pelo dono: guarda a versão e o momento, e registra no histórico. */
export async function acceptTerms(ctx: Ctx, version: string) {
  assertRole(ctx, "dono");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ termsVersion: version, termsAcceptedAt: new Date() }).where(eq(users.id, ctx.userId));
    await audit(tx, ctx, "termos.aceite", "user", ctx.userId, { version });
  });
}

export async function setUserActive(ctx: Ctx, userId: string, active: boolean) {
  assertRole(ctx, "dono");
  if (userId === ctx.userId) throw new DomainError("Você não pode desativar o próprio usuário.");
  await db.transaction(async (tx) => {
    const [u] = await tx
      .update(users)
      .set({ active })
      .where(and(eq(users.id, userId), eq(users.tenantId, ctx.tenantId)))
      .returning({ id: users.id });
    if (!u) throw new DomainError("Usuário não encontrado.");
    await audit(tx, ctx, active ? "usuario.ativar" : "usuario.desativar", "user", u.id);
  });
}
