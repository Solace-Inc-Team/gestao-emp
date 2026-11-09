import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { orders, orderItems, customers, shifts, expenses } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { orderTotal } from "@/lib/cash";
import { todayISO } from "@/lib/period";
import { audit, lockProducts, move } from "./stock";
import { fiadoBalance } from "./receivables";

export const newOrderSchema = z
  .object({
    mode: z.enum(["entrega", "balcao"]),
    customerId: z.uuid().nullable(),
    items: z
      .array(z.object({ productId: z.uuid(), quantity: z.int().min(1).max(99), returnsEmpty: z.boolean() }))
      .min(1, "Adicione ao menos um item."),
    paymentMethod: z.enum(["dinheiro", "pix", "cartao", "fiado"]),
    deliveryFeeCents: z.int().min(0).max(100_00),
    changeForCents: z.int().min(0).nullable(),
    notes: z.string().max(500),
    driverId: z.uuid().nullable(),
  })
  .refine((o) => o.mode === "balcao" || o.customerId, { message: "Entrega precisa de cliente." })
  .refine((o) => o.paymentMethod !== "fiado" || o.customerId, { message: "Fiado precisa de cliente identificado." });

export type NewOrder = z.infer<typeof newOrderSchema>;

async function loadOrder(tx: Tx, ctx: Ctx, orderId: string) {
  const [o] = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, ctx.tenantId)))
    .for("update");
  if (!o) throw new DomainError("Pedido não encontrado.");
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const prods = await lockProducts(tx, ctx, [...new Set(items.map((i) => i.productId))]);
  const name = (id: string) => prods.find((p) => p.id === id)?.name ?? "produto";
  const returnable = (id: string) => prods.find((p) => p.id === id)?.returnable ?? false;
  return { o, items, name, returnable };
}

export async function createOrder(ctx: Ctx, input: NewOrder) {
  assertRole(ctx, "dono", "atendente");
  return db.transaction(async (tx) => {
    // preço sempre do banco, nunca do form
    const prods = await lockProducts(tx, ctx, [...new Set(input.items.map((i) => i.productId))]);
    const items = input.items.map((i) => {
      const p = prods.find((x) => x.id === i.productId && x.active);
      if (!p) throw new DomainError("Produto indisponível.");
      return { ...i, unitPriceCents: p.priceCents, returnsEmpty: p.returnable && i.returnsEmpty, name: p.name };
    });

    if (input.customerId) {
      const [c] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, input.customerId), eq(customers.tenantId, ctx.tenantId)));
      if (!c) throw new DomainError("Cliente não encontrado.");
    }

    const fee = input.mode === "balcao" ? 0 : input.deliveryFeeCents;
    const total = orderTotal(items, fee);
    if (input.paymentMethod === "dinheiro" && input.changeForCents !== null && input.changeForCents < total)
      throw new DomainError("O valor para troco é menor que o total.");

    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${orders.number}), 0)::int + 1` })
      .from(orders)
      .where(eq(orders.tenantId, ctx.tenantId));

    const now = new Date();
    const [order] = await tx
      .insert(orders)
      .values({
        tenantId: ctx.tenantId,
        number: next,
        customerId: input.customerId,
        paymentMethod: input.paymentMethod,
        deliveryFeeCents: fee,
        totalCents: total,
        changeForCents: input.paymentMethod === "dinheiro" ? input.changeForCents : null,
        notes: input.notes,
        createdBy: ctx.userId,
        ...(input.mode === "balcao" ? { status: "entregue" as const, deliveredAt: now } : {}),
      })
      .returning();

    await tx.insert(orderItems).values(
      items.map((i) => ({
        tenantId: ctx.tenantId,
        orderId: order.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        returnsEmpty: i.returnsEmpty,
      })),
    );

    if (input.mode === "balcao") {
      for (const i of items) {
        const base = { productId: i.productId, driverId: null, orderId: order.id, reason: `venda balcão #${next}` };
        await move(tx, ctx, { ...base, state: "cheio", quantity: -i.quantity }, i.name);
        if (i.returnsEmpty) await move(tx, ctx, { ...base, state: "vazio", quantity: i.quantity }, i.name);
      }
    }

    await audit(tx, ctx, "pedido.criar", "order", order.id, { number: next, total, mode: input.mode });
    if (input.mode === "entrega" && input.driverId) await dispatchInTx(tx, ctx, order.id, input.driverId);
    return order;
  });
}

async function dispatchInTx(tx: Tx, ctx: Ctx, orderId: string, driverId: string) {
  const { o, items, name } = await loadOrder(tx, ctx, orderId);
  if (o.status !== "aberto") throw new DomainError("Só pedidos em aberto podem sair para entrega.");
  const [shift] = await tx
    .select()
    .from(shifts)
    .where(and(eq(shifts.tenantId, ctx.tenantId), eq(shifts.driverId, driverId), eq(shifts.status, "aberto")));
  if (!shift) throw new DomainError("Este entregador não tem turno aberto. Abra o turno no Caixa.");

  for (const i of items) {
    const base = { productId: i.productId, orderId: o.id, shiftId: shift.id, reason: `saída pedido #${o.number}` };
    await move(tx, ctx, { ...base, state: "cheio", driverId: null, quantity: -i.quantity }, name(i.productId));
    await move(tx, ctx, { ...base, state: "cheio", driverId, quantity: i.quantity }, name(i.productId));
  }
  await tx
    .update(orders)
    .set({ status: "em_rota", driverId, shiftId: shift.id, dispatchedAt: new Date() })
    .where(eq(orders.id, o.id));
  await audit(tx, ctx, "pedido.saida", "order", o.id, { driverId, shiftId: shift.id });
}

export async function dispatchOrder(ctx: Ctx, orderId: string, driverId: string) {
  assertRole(ctx, "dono", "atendente");
  await db.transaction((tx) => dispatchInTx(tx, ctx, orderId, driverId));
}

export async function deliverOrder(ctx: Ctx, orderId: string) {
  await db.transaction(async (tx) => {
    const { o, items, name } = await loadOrder(tx, ctx, orderId);
    if (ctx.role === "entregador" && o.driverId !== ctx.userId) throw new DomainError("Pedido de outro entregador.");
    if (o.status !== "em_rota" || !o.driverId) throw new DomainError("Pedido não está em rota.");
    for (const i of items) {
      const base = { productId: i.productId, orderId: o.id, shiftId: o.shiftId ?? undefined, driverId: o.driverId };
      const reason = `entrega pedido #${o.number}`;
      await move(tx, ctx, { ...base, state: "cheio", quantity: -i.quantity, reason }, name(i.productId));
      if (i.returnsEmpty) await move(tx, ctx, { ...base, state: "vazio", quantity: i.quantity, reason }, name(i.productId));
    }
    await tx.update(orders).set({ status: "entregue", deliveredAt: new Date() }).where(eq(orders.id, o.id));
    await audit(tx, ctx, "pedido.entregue", "order", o.id);
  });
}

export async function cancelOrder(ctx: Ctx, orderId: string, reason: string) {
  assertRole(ctx, "dono", "atendente");
  if (reason.trim().length < 3) throw new DomainError("Informe o motivo do cancelamento.");
  await db.transaction(async (tx) => {
    const { o, items, name } = await loadOrder(tx, ctx, orderId);
    if (o.status === "entregue") throw new DomainError("Pedido entregue não pode ser cancelado (estorno ainda não disponível).");
    if (o.status === "cancelado") throw new DomainError("Pedido já cancelado.");
    if (o.status === "em_rota" && o.driverId) {
      for (const i of items) {
        const base = { productId: i.productId, orderId: o.id, shiftId: o.shiftId ?? undefined, state: "cheio" as const };
        const r = `retorno cancelamento #${o.number}`;
        await move(tx, ctx, { ...base, driverId: o.driverId, quantity: -i.quantity, reason: r }, name(i.productId));
        await move(tx, ctx, { ...base, driverId: null, quantity: i.quantity, reason: r }, name(i.productId));
      }
    }
    await tx.update(orders).set({ status: "cancelado", cancelReason: reason.trim() }).where(eq(orders.id, o.id));
    await audit(tx, ctx, "pedido.cancelar", "order", o.id, { reason, previous: o.status });
  });
}

/**
 * Estorno de pedido já entregue. A venda sai dos números; se o cliente devolveu
 * os produtos, eles voltam ao estoque da loja; o dinheiro devolvido vira saída de caixa.
 */
export async function refundOrder(ctx: Ctx, input: { orderId: string; reason: string; restock: boolean }) {
  assertRole(ctx, "dono");
  if (input.reason.trim().length < 3) throw new DomainError("Informe o motivo do estorno.");
  await db.transaction(async (tx) => {
    const { o, items, name } = await loadOrder(tx, ctx, input.orderId);
    if (o.status !== "entregue") throw new DomainError("Só pedidos entregues podem ser estornados.");

    if (o.paymentMethod === "dinheiro" && o.shiftId) {
      const [sh] = await tx.select({ status: shifts.status }).from(shifts).where(eq(shifts.id, o.shiftId));
      if (sh?.status === "aberto")
        throw new DomainError("O turno deste pedido ainda está aberto. Faça o acerto do entregador antes de estornar.");
    }
    if (o.paymentMethod === "fiado" && o.customerId) {
      // trava o cliente junto com os pagamentos de fiado
      await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, o.customerId)).for("update");
      const owed = await fiadoBalance(tx, ctx.tenantId, o.customerId);
      if (owed < o.totalCents)
        throw new DomainError("O cliente já pagou parte deste fiado. Estorne os pagamentos antes de estornar o pedido.");
    }

    if (input.restock) {
      for (const i of items) {
        const base = { productId: i.productId, driverId: null, orderId: o.id, reason: `estorno pedido #${o.number}` };
        await move(tx, ctx, { ...base, state: "cheio", quantity: i.quantity }, name(i.productId));
        // o cliente recebe de volta o vazio que tinha entregado na troca
        if (i.returnsEmpty) await move(tx, ctx, { ...base, state: "vazio", quantity: -i.quantity }, name(i.productId));
      }
    }

    await tx
      .update(orders)
      .set({ status: "estornado", refundReason: input.reason.trim(), refundedAt: new Date() })
      .where(eq(orders.id, o.id));

    if (o.paymentMethod !== "fiado") {
      await tx.insert(expenses).values({
        tenantId: ctx.tenantId,
        category: "estorno",
        description: `Devolução do pedido #${o.number}`,
        amountCents: o.totalCents,
        method: o.paymentMethod,
        paidOn: todayISO(),
        orderId: o.id,
        createdBy: ctx.userId,
      });
    }
    await audit(tx, ctx, "pedido.estornar", "order", o.id, input);
  });
}
