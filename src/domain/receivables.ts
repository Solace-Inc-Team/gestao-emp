import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, scoped, tenantTransaction, type Tx } from "@/db";
import { customerPayments, customers, orders, users } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { audit } from "./stock";

// Fiado: o cliente deve a soma dos pedidos fiado ENTREGUES menos o que já pagou.
// Pedido em aberto ou em rota ainda não é dívida.

export async function fiadoBalance(exec: Tx | typeof db, tenantId: string, customerId: string) {
  const [r] = await exec.execute<{ owed: number; paid: number }>(sql`
    select
      (select coalesce(sum(total_cents), 0)::int from orders
        where tenant_id = ${tenantId} and customer_id = ${customerId}
          and payment_method = 'fiado' and status = 'entregue') as owed,
      (select coalesce(sum(amount_cents), 0)::int from customer_payments
        where tenant_id = ${tenantId} and customer_id = ${customerId} and voided_at is null) as paid
  `);
  return r.owed - r.paid;
}

export const customerBalance = scoped((tenantId: string, customerId: string) => fiadoBalance(db, tenantId, customerId));

export const paymentSchema = z.object({
  customerId: z.uuid(),
  amountCents: z.int().min(1, "Informe o valor recebido."),
  method: z.enum(["dinheiro", "pix", "cartao"], { message: "Escolha como o cliente pagou." }),
  note: z.string().trim().max(200, "A observação pode ter até 200 letras."),
});

export async function receivePayment(ctx: Ctx, input: z.infer<typeof paymentSchema>) {
  assertRole(ctx, "dono", "atendente");
  return tenantTransaction(ctx, async (tx) => {
    // trava o cliente: dois pagamentos ao mesmo tempo não passam juntos pela checagem de saldo
    const [c] = await tx
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(and(eq(customers.id, input.customerId), eq(customers.tenantId, ctx.tenantId)))
      .for("update");
    if (!c) throw new DomainError("Cliente não encontrado.");
    const owed = await fiadoBalance(tx, ctx.tenantId, c.id);
    if (owed <= 0) throw new DomainError(`${c.name} não tem fiado em aberto.`);
    if (input.amountCents > owed)
      throw new DomainError(`O valor passa do saldo devedor (R$ ${(owed / 100).toFixed(2).replace(".", ",")}).`);
    const [p] = await tx
      .insert(customerPayments)
      .values({ ...input, tenantId: ctx.tenantId, receivedBy: ctx.userId })
      .returning();
    await audit(tx, ctx, "fiado.pagamento", "customer", c.id, { amountCents: input.amountCents, method: input.method, before: owed });
    return p;
  });
}

export async function voidPayment(ctx: Ctx, paymentId: string, reason: string) {
  assertRole(ctx, "dono");
  if (reason.trim().length < 3) throw new DomainError("Informe o motivo do estorno.");
  await tenantTransaction(ctx, async (tx) => {
    const [p] = await tx
      .update(customerPayments)
      .set({ voidedAt: new Date(), voidedBy: ctx.userId, voidReason: reason.trim() })
      .where(and(eq(customerPayments.id, paymentId), eq(customerPayments.tenantId, ctx.tenantId), isNull(customerPayments.voidedAt)))
      .returning();
    if (!p) throw new DomainError("Pagamento não encontrado ou já estornado.");
    await audit(tx, ctx, "fiado.estorno_pagamento", "customer", p.customerId, { paymentId, amountCents: p.amountCents, reason });
  });
}

/** Clientes com saldo devedor, da dívida mais antiga para a mais nova. */
export const listDebtors = scoped(async function listDebtors(tenantId: string) {
  return db.execute<{ id: string; name: string; phone: string; owed: number; oldest: string | Date; last_payment: string | Date | null }>(sql`
    with fiado as (
      select customer_id, sum(total_cents)::int as total, min(delivered_at) as oldest
      from orders
      where tenant_id = ${tenantId} and payment_method = 'fiado' and status = 'entregue'
      group by customer_id
    ), pago as (
      select customer_id, sum(amount_cents)::int as total, max(created_at) as last_payment
      from customer_payments where tenant_id = ${tenantId} and voided_at is null
      group by customer_id
    )
    select c.id, c.name, c.phone, (f.total - coalesce(p.total, 0))::int as owed, f.oldest, p.last_payment
    from fiado f
    join customers c on c.id = f.customer_id and c.tenant_id = ${tenantId}
    left join pago p on p.customer_id = f.customer_id
    where f.total - coalesce(p.total, 0) > 0
    order by f.oldest
  `);
});

/** Extrato do cliente: compras fiado e pagamentos, do mais recente para o mais antigo. */
export const customerStatement = scoped(async function customerStatement(tenantId: string, customerId: string) {
  const bought = await db
    .select({ id: orders.id, number: orders.number, at: orders.deliveredAt, amount: orders.totalCents })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.customerId, customerId),
        eq(orders.paymentMethod, "fiado"),
        eq(orders.status, "entregue"),
      ),
    );
  const paid = await db
    .select({
      id: customerPayments.id,
      at: customerPayments.createdAt,
      amount: customerPayments.amountCents,
      method: customerPayments.method,
      note: customerPayments.note,
      by: users.name,
      voidedAt: customerPayments.voidedAt,
      voidReason: customerPayments.voidReason,
    })
    .from(customerPayments)
    .innerJoin(users, eq(users.id, customerPayments.receivedBy))
    .where(and(eq(customerPayments.tenantId, tenantId), eq(customerPayments.customerId, customerId)))
    .orderBy(desc(customerPayments.createdAt));
  const entries = [
    ...bought.map((b) => ({ kind: "compra" as const, ...b, method: null, note: "", by: null, voidedAt: null, voidReason: null })),
    ...paid.map((p) => ({ kind: "pagamento" as const, number: null, ...p })),
  ].sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime());
  const owed = bought.reduce((s, b) => s + b.amount, 0) - paid.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  return { owed, entries };
});

/** Fiado recebido por dia no período (para relatórios). */
export const paymentsByDay = scoped(async function paymentsByDay(tenantId: string, from: Date, to: Date) {
  return db.execute<{ day: string; total: number }>(sql`
    select to_char(created_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as day, sum(amount_cents)::int as total
    from customer_payments
    where tenant_id = ${tenantId} and voided_at is null and created_at >= ${from.toISOString()} and created_at < ${to.toISOString()}
    group by 1 order by 1
  `);
});
