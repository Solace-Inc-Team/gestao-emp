import { z } from "zod";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { tenantTransaction } from "@/db";
import { auditLog, customerAddresses, customers, orders, products, sessions, tenants, users } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { hashPassword } from "@/lib/password";
import { audit } from "./stock";
import { fiadoBalance } from "./receivables";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(120, "O nome pode ter até 120 letras."),
  phone: z.string().trim().max(30, "Telefone muito longo."),
  address: z.string().trim().max(200, "O endereço pode ter até 200 letras."),
  reference: z.string().trim().max(200, "A referência pode ter até 200 letras."),
  notes: z.string().trim().max(500, "A observação pode ter até 500 letras."),
});

export async function saveCustomer(ctx: Ctx, input: z.infer<typeof customerSchema>, id?: string) {
  assertRole(ctx, "dono", "atendente", "caixa");
  return tenantTransaction(ctx, async (tx) => {
    if (id) {
      const [c] = await tx
        .update(customers)
        .set(input)
        .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId), isNull(customers.anonymizedAt)))
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

/**
 * LGPD: a pedido do cliente, apaga nome, contato e endereço (inclusive do histórico de alterações).
 * Os pedidos ficam, sem identificar a pessoa, para o caixa e os relatórios continuarem certos.
 */
export async function anonymizeCustomer(ctx: Ctx, customerId: string) {
  assertRole(ctx, "dono");
  await tenantTransaction(ctx, async (tx) => {
    const [c] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, ctx.tenantId)))
      .for("update");
    if (!c) throw new DomainError("Cliente não encontrado.");
    if (c.anonymizedAt) throw new DomainError("Os dados deste cliente já foram apagados.");
    if ((await fiadoBalance(tx, ctx.tenantId, c.id)) > 0) throw new DomainError("Este cliente tem fiado em aberto. Receba ou estorne antes de apagar os dados.");
    const [busy] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.customerId, c.id), inArray(orders.status, ["aberto", "em_rota"])));
    if (busy) throw new DomainError("Este cliente tem pedido em andamento. Conclua ou cancele antes.");
    await tx
      .update(customers)
      .set({ name: "Cliente removido", phone: "", address: "", reference: "", notes: "", anonymizedAt: new Date() })
      .where(eq(customers.id, c.id));
    await tx.delete(customerAddresses).where(eq(customerAddresses.customerId, c.id));
    await tx.update(orders).set({ address: null, reference: null }).where(eq(orders.customerId, c.id));
    await tx.update(auditLog).set({ data: null }).where(and(eq(auditLog.entity, "customer"), eq(auditLog.entityId, c.id)));
    await audit(tx, ctx, "cliente.anonimizar", "customer", c.id);
  });
}

export const addressSchema = z.object({
  customerId: z.uuid(),
  label: z.string().trim().min(2, "Dê um nome ao endereço (ex.: Trabalho).").max(40, "O nome do endereço pode ter até 40 letras."),
  address: z.string().trim().min(5, "Informe o endereço.").max(200, "O endereço pode ter até 200 letras."),
  reference: z.string().trim().max(200, "A referência pode ter até 200 letras."),
});

export async function addAddress(ctx: Ctx, input: z.infer<typeof addressSchema>) {
  assertRole(ctx, "dono", "atendente", "caixa");
  await tenantTransaction(ctx, async (tx) => {
    const [c] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, input.customerId), eq(customers.tenantId, ctx.tenantId), isNull(customers.anonymizedAt)));
    if (!c) throw new DomainError("Cliente não encontrado.");
    await tx.insert(customerAddresses).values({ ...input, tenantId: ctx.tenantId });
    await audit(tx, ctx, "cliente.endereco", "customer", c.id);
  });
}

export async function removeAddress(ctx: Ctx, addressId: string) {
  assertRole(ctx, "dono", "atendente", "caixa");
  await tenantTransaction(ctx, async (tx) => {
    const [a] = await tx
      .delete(customerAddresses)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.tenantId, ctx.tenantId)))
      .returning({ customerId: customerAddresses.customerId });
    if (!a) throw new DomainError("Endereço não encontrado.");
    await audit(tx, ctx, "cliente.remover_endereco", "customer", a.customerId);
  });
}

export const settingsSchema = z.object({
  staffDiscountPct: z.int().min(0, "O limite vai de 0 a 100%.").max(100, "O limite vai de 0 a 100%."),
  lateAfterMinutes: z.int().min(10, "O prazo vai de 10 minutos a 24 horas.").max(1440, "O prazo vai de 10 minutos a 24 horas."),
});

export async function saveSettings(ctx: Ctx, input: z.infer<typeof settingsSchema>) {
  assertRole(ctx, "dono");
  await tenantTransaction(ctx, async (tx) => {
    await tx.update(tenants).set(input).where(eq(tenants.id, ctx.tenantId));
    await audit(tx, ctx, "empresa.regras", "tenant", ctx.tenantId, input);
  });
}

export const productSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(80, "O nome pode ter até 80 letras."),
  priceCents: z.int().min(0).max(100_000_00, "Preço muito alto."),
  returnable: z.boolean(),
  minStock: z.int().min(0, "Estoque mínimo inválido.").max(100_000, "Estoque mínimo muito alto."),
  containerPriceCents: z.int().min(0).max(100_000_00, "Preço do vasilhame muito alto.").default(0),
  active: z.boolean(),
});

export async function saveProduct(ctx: Ctx, raw: z.input<typeof productSchema>, id?: string) {
  assertRole(ctx, "dono");
  const input = productSchema.parse(raw);
  return tenantTransaction(ctx, async (tx) => {
    // dois produtos com o mesmo nome confundem a entrada de estoque e o pedido
    const [same] = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.tenantId, ctx.tenantId), sql`lower(${products.name}) = lower(${input.name})`, id ? ne(products.id, id) : undefined));
    if (same) throw new DomainError("Já existe um produto com este nome.");
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
  name: z.string().trim().min(2, "Nome muito curto.").max(80, "O nome pode ter até 80 letras."),
  email: z.email("E-mail inválido.").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Senha precisa de ao menos 8 caracteres."),
  role: z.enum(["dono", "atendente", "caixa", "entregador"], { message: "Escolha a função." }),
});

export async function createUser(ctx: Ctx, input: z.infer<typeof userSchema>) {
  assertRole(ctx, "dono");
  const passwordHash = await hashPassword(input.password);
  try {
    return await tenantTransaction(ctx, async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ tenantId: ctx.tenantId, name: input.name, email: input.email, role: input.role, passwordHash })
        .returning({ id: users.id });
      await audit(tx, ctx, "usuario.criar", "user", u.id, { email: input.email, role: input.role });
      return u;
    });
  } catch (e) {
    // o e-mail pode estar em outra empresa, que o RLS não deixa consultar: quem acusa é o índice único
    const code = (e as { code?: string; cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code;
    if (code === "23505") throw new DomainError("Já existe um usuário com este e-mail.");
    throw e;
  }
}

export async function resetUserPassword(ctx: Ctx, userId: string, password: string) {
  assertRole(ctx, "dono");
  if (userId === ctx.userId) throw new DomainError("Para trocar a sua própria senha, use a página Senha.");
  if (password.length < 8) throw new DomainError("A senha nova precisa de ao menos 8 caracteres.");
  const passwordHash = await hashPassword(password);
  await tenantTransaction(ctx, async (tx) => {
    const [u] = await tx
      .update(users)
      // quem perdeu o celular também perde o 2FA: desliga para ativar de novo no aparelho novo
      .set({ passwordHash, totpEnabled: false, totpSecret: null })
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
  await tenantTransaction(ctx, async (tx) => {
    await tx.update(users).set({ termsVersion: version, termsAcceptedAt: new Date() }).where(eq(users.id, ctx.userId));
    await audit(tx, ctx, "termos.aceite", "user", ctx.userId, { version });
  });
}

export async function setUserActive(ctx: Ctx, userId: string, active: boolean) {
  assertRole(ctx, "dono");
  if (userId === ctx.userId) throw new DomainError("Você não pode desativar o próprio usuário.");
  await tenantTransaction(ctx, async (tx) => {
    const [u] = await tx
      .update(users)
      .set({ active })
      .where(and(eq(users.id, userId), eq(users.tenantId, ctx.tenantId)))
      .returning({ id: users.id });
    if (!u) throw new DomainError("Usuário não encontrado.");
    await audit(tx, ctx, active ? "usuario.ativar" : "usuario.desativar", "user", u.id);
  });
}
