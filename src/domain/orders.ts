import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { tenantTransaction, type Tx } from "@/db";
import { orders, orderItems, customers, customerAddresses, shifts, expenses, tenants } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { itemsSubtotal, orderTotal } from "@/lib/cash";
import { formatBRL } from "@/lib/money";
import { todayISO } from "@/lib/period";
import { audit, lockProducts, move } from "./stock";
import { fiadoBalance } from "./receivables";

export const newOrderSchema = z
  .object({
    mode: z.enum(["entrega", "balcao"]),
    customerId: z.uuid().nullable(),
    items: z
      .array(z.object({ productId: z.uuid(), quantity: z.int().min(1, "Quantidade mínima é 1.").max(99, "No máximo 99 unidades por item."), returnsEmpty: z.boolean() }))
      .min(1, "Adicione ao menos um item."),
    paymentMethod: z.enum(["dinheiro", "pix", "cartao", "fiado"]),
    cashPartCents: z.int().min(0).max(100_000_00, "Valor em dinheiro muito alto.").default(0),
    origin: z.enum(["whatsapp", "telefone", "balcao"]).default("telefone"),
    addressId: z.uuid().nullable().default(null),
    discountCents: z.int().min(0, "Desconto inválido.").max(100_000_00, "Desconto muito alto.").default(0),
    discountReason: z.string().trim().max(160, "O motivo do desconto pode ter até 160 letras.").default(""),
    deliveryFeeCents: z.int().min(0, "Taxa de entrega inválida.").max(100_00, "A taxa de entrega vai até R$ 100,00."),
    changeForCents: z.int().min(0).max(100_000_00, "Valor para troco muito alto.").nullable(),
    notes: z.string().max(500, "A observação pode ter até 500 letras."),
    driverId: z.uuid().nullable(),
  })
  .refine((o) => o.mode === "balcao" || o.customerId, { message: "Entrega precisa de cliente." })
  .refine((o) => o.paymentMethod !== "fiado" || o.customerId, { message: "Fiado precisa de cliente identificado." })
  .refine((o) => !o.cashPartCents || o.paymentMethod === "pix" || o.paymentMethod === "cartao", {
    message: "Parte em dinheiro só vale para pedido no Pix ou no cartão.",
  })
  .refine((o) => !o.discountCents || o.discountReason.length >= 3, { message: "Informe o motivo do desconto." });

export const originLabel = { whatsapp: "WhatsApp", telefone: "Telefone", balcao: "Balcão", portal: "Portal" } as const;

export const occurrenceKinds = {
  ausente: "Cliente ausente",
  endereco: "Endereço não encontrado",
  recusou: "Cliente recusou",
  sem_pagamento: "Cliente sem dinheiro ou sem troco",
  outro: "Outro motivo",
} as const;

export type NewOrder = z.input<typeof newOrderSchema>;

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

export async function createOrder(ctx: Ctx, raw: NewOrder) {
  assertRole(ctx, "dono", "atendente", "caixa");
  const input = newOrderSchema.parse(raw);
  return tenantTransaction(ctx, async (tx) => {
    // preço sempre do banco, nunca do form
    const prods = await lockProducts(tx, ctx, [...new Set(input.items.map((i) => i.productId))]);
    const items = input.items.map((i) => {
      const p = prods.find((x) => x.id === i.productId && x.active);
      if (!p) throw new DomainError("Produto indisponível.");
      const returnsEmpty = p.returnable && i.returnsEmpty;
      // sem vazio para trocar, o cliente compra o vasilhame junto
      const container = p.returnable && !returnsEmpty ? p.containerPriceCents : 0;
      return { ...i, unitPriceCents: p.priceCents + container, returnsEmpty, name: p.name };
    });

    if (input.customerId) {
      const [c] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, input.customerId), eq(customers.tenantId, ctx.tenantId), isNull(customers.anonymizedAt)));
      if (!c) throw new DomainError("Cliente não encontrado.");
    }
    let place: { address: string; reference: string } | null = null;
    if (input.mode === "entrega" && input.addressId && input.customerId) {
      [place] = await tx
        .select({ address: customerAddresses.address, reference: customerAddresses.reference })
        .from(customerAddresses)
        .where(and(eq(customerAddresses.id, input.addressId), eq(customerAddresses.customerId, input.customerId)));
      if (!place) throw new DomainError("Endereço de entrega não encontrado.");
    }

    // trava a empresa: dois pedidos ao mesmo tempo não pegam o mesmo número
    const [house] = await tx
      .select({ staffDiscountPct: tenants.staffDiscountPct })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .for("update");

    const subtotal = itemsSubtotal(items);
    if (input.discountCents > subtotal) throw new DomainError("O desconto não pode ser maior que o valor dos produtos.");
    // desconto acima do limite da casa só com o dono
    const limit = Math.floor((subtotal * house.staffDiscountPct) / 100);
    if (ctx.role !== "dono" && input.discountCents > limit)
      throw new DomainError(`Desconto acima do seu limite (${house.staffDiscountPct}%, até ${formatBRL(limit)} neste pedido). Peça ao dono para lançar.`);

    const fee = input.mode === "balcao" ? 0 : input.deliveryFeeCents;
    const total = orderTotal(items, fee, input.discountCents);
    if (input.paymentMethod === "dinheiro" && input.changeForCents !== null && input.changeForCents < total)
      throw new DomainError("O valor para troco é menor que o total.");
    if (input.cashPartCents >= total && input.cashPartCents > 0)
      throw new DomainError("A parte em dinheiro precisa ser menor que o total. Se for tudo em dinheiro, escolha Dinheiro.");

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
        cashPartCents: input.cashPartCents,
        origin: input.mode === "balcao" ? "balcao" : input.origin,
        address: place?.address,
        reference: place?.reference,
        deliveryFeeCents: fee,
        discountCents: input.discountCents,
        discountReason: input.discountCents ? input.discountReason : null,
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

    await audit(tx, ctx, "pedido.criar", "order", order.id, { number: next, total, mode: input.mode, discount: input.discountCents || undefined });
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
    .where(and(eq(shifts.tenantId, ctx.tenantId), eq(shifts.driverId, driverId), eq(shifts.status, "aberto")))
    // espera um acerto em andamento terminar; se ele fechar o turno, esta busca não acha mais nada
    .for("update");
  if (!shift) throw new DomainError("Este entregador não tem turno aberto. Abra o turno no Caixa.");

  for (const i of items) {
    const base = { productId: i.productId, orderId: o.id, shiftId: shift.id, reason: `saída pedido #${o.number}` };
    await move(tx, ctx, { ...base, state: "cheio", driverId: null, quantity: -i.quantity }, name(i.productId));
    await move(tx, ctx, { ...base, state: "cheio", driverId, quantity: i.quantity }, name(i.productId));
  }
  await tx
    .update(orders)
    .set({ status: "em_rota", driverId, shiftId: shift.id, dispatchedAt: new Date(), occurrence: null, occurrenceAt: null })
    .where(eq(orders.id, o.id));
  await audit(tx, ctx, "pedido.saida", "order", o.id, { driverId, shiftId: shift.id });
}

// tira da conta do entregador os cheios de um pedido que não vai mais ser entregue por ele
async function returnToStore(tx: Tx, ctx: Ctx, loaded: Awaited<ReturnType<typeof loadOrder>>, reason: string) {
  const { o, items, name } = loaded;
  for (const i of items) {
    const base = { productId: i.productId, orderId: o.id, shiftId: o.shiftId ?? undefined, state: "cheio" as const, reason };
    await move(tx, ctx, { ...base, driverId: o.driverId, quantity: -i.quantity }, name(i.productId));
    await move(tx, ctx, { ...base, driverId: null, quantity: i.quantity }, name(i.productId));
  }
}

/** Tentativa de entrega que não deu certo: o pedido volta para a fila com o motivo, e a carga volta para a loja. */
export async function reportOccurrence(ctx: Ctx, orderId: string, kind: string, note: string) {
  if (!(kind in occurrenceKinds)) throw new DomainError("Escolha o que aconteceu.");
  if (kind === "outro" && note.trim().length < 3) throw new DomainError("Conte o que aconteceu.");
  await tenantTransaction(ctx, async (tx) => {
    const loaded = await loadOrder(tx, ctx, orderId);
    const { o } = loaded;
    if (ctx.role === "entregador" && o.driverId !== ctx.userId) throw new DomainError("Pedido de outro entregador.");
    if (o.status !== "em_rota" || !o.driverId) throw new DomainError("Pedido não está em rota.");
    await returnToStore(tx, ctx, loaded, `retorno sem entrega #${o.number}`);
    const text = [occurrenceKinds[kind as keyof typeof occurrenceKinds], note.trim()].filter(Boolean).join(": ");
    await tx
      .update(orders)
      .set({ status: "aberto", driverId: null, shiftId: null, dispatchedAt: null, occurrence: text, occurrenceAt: new Date() })
      .where(eq(orders.id, o.id));
    await audit(tx, ctx, "pedido.ocorrencia", "order", o.id, { kind, note: note.trim(), driverId: o.driverId });
  });
}

/** Passa um pedido em rota para outro entregador; a carga muda de mão junto. */
export async function reassignOrder(ctx: Ctx, orderId: string, driverId: string) {
  assertRole(ctx, "dono", "atendente", "caixa");
  await tenantTransaction(ctx, async (tx) => {
    const { o, items, name } = await loadOrder(tx, ctx, orderId);
    if (o.status !== "em_rota" || !o.driverId) throw new DomainError("Só pedidos em rota podem trocar de entregador.");
    if (o.driverId === driverId) throw new DomainError("O pedido já está com este entregador.");
    const [shift] = await tx
      .select()
      .from(shifts)
      .where(and(eq(shifts.tenantId, ctx.tenantId), eq(shifts.driverId, driverId), eq(shifts.status, "aberto")))
      .for("update");
    if (!shift) throw new DomainError("Este entregador não tem turno aberto. Abra o turno no Caixa.");
    for (const i of items) {
      const base = { productId: i.productId, orderId: o.id, state: "cheio" as const, reason: `troca de entregador #${o.number}` };
      await move(tx, ctx, { ...base, shiftId: o.shiftId ?? undefined, driverId: o.driverId, quantity: -i.quantity }, name(i.productId));
      await move(tx, ctx, { ...base, shiftId: shift.id, driverId, quantity: i.quantity }, name(i.productId));
    }
    await tx.update(orders).set({ driverId, shiftId: shift.id }).where(eq(orders.id, o.id));
    await audit(tx, ctx, "pedido.trocar_entregador", "order", o.id, { from: o.driverId, to: driverId });
  });
}

export async function dispatchOrder(ctx: Ctx, orderId: string, driverId: string) {
  assertRole(ctx, "dono", "atendente", "caixa");
  await tenantTransaction(ctx, (tx) => dispatchInTx(tx, ctx, orderId, driverId));
}

/**
 * Confirma a entrega. Em entrega parcial, `partial` diz quanto de cada item chegou ao cliente:
 * o total do pedido é refeito e o que sobrou continua com o entregador até o acerto.
 */
export async function deliverOrder(ctx: Ctx, orderId: string, partial?: { delivered: Record<string, number>; note: string }) {
  await tenantTransaction(ctx, async (tx) => {
    const { o, items, name } = await loadOrder(tx, ctx, orderId);
    if (ctx.role === "entregador" && o.driverId !== ctx.userId) throw new DomainError("Pedido de outro entregador.");
    // confirmação repetida (celular sem rede reenviando): já está entregue, não faz nada de novo
    if (o.status === "entregue" && !partial) return;
    if (o.status !== "em_rota" || !o.driverId) throw new DomainError("Pedido não está em rota.");

    const got = items.map((i) => {
      const q = partial?.delivered[i.id] ?? i.quantity;
      if (!Number.isInteger(q) || q < 0 || q > i.quantity) throw new DomainError(`Quantidade entregue inválida para ${name(i.productId)}.`);
      return { ...i, got: q };
    });
    const isPartial = got.some((i) => i.got < i.quantity);
    if (isPartial) {
      if (got.every((i) => i.got === 0)) throw new DomainError("Nada foi entregue: use \"Não consegui entregar\".");
      if ((partial?.note.trim().length ?? 0) < 3) throw new DomainError("Explique por que a entrega foi parcial.");
    }

    for (const i of got.filter((i) => i.got > 0)) {
      const base = { productId: i.productId, orderId: o.id, shiftId: o.shiftId ?? undefined, driverId: o.driverId };
      const reason = `entrega pedido #${o.number}`;
      await move(tx, ctx, { ...base, state: "cheio", quantity: -i.got, reason }, name(i.productId));
      if (i.returnsEmpty) await move(tx, ctx, { ...base, state: "vazio", quantity: i.got, reason }, name(i.productId));
    }

    const changes: Partial<typeof orders.$inferInsert> = { status: "entregue", deliveredAt: new Date() };
    if (isPartial) {
      for (const i of got) await tx.update(orderItems).set({ deliveredQuantity: i.got }).where(eq(orderItems.id, i.id));
      const delivered = got.map((i) => ({ quantity: i.got, unitPriceCents: i.unitPriceCents }));
      const discount = Math.min(o.discountCents, itemsSubtotal(delivered));
      const total = orderTotal(delivered, o.deliveryFeeCents, discount);
      Object.assign(changes, {
        totalCents: total,
        discountCents: discount,
        // a conta mudou: troco e divisão do pagamento combinados antes deixam de valer
        changeForCents: null,
        cashPartCents: Math.min(o.cashPartCents, total),
        notes: [o.notes, `Entrega parcial: ${partial!.note.trim()}`].filter(Boolean).join(" | "),
      });
    }
    await tx.update(orders).set(changes).where(eq(orders.id, o.id));
    await audit(tx, ctx, isPartial ? "pedido.entrega_parcial" : "pedido.entregue", "order", o.id, isPartial ? { before: o.totalCents, after: changes.totalCents, note: partial!.note } : undefined);
  });
}

export async function cancelOrder(ctx: Ctx, orderId: string, reason: string) {
  assertRole(ctx, "dono", "atendente", "caixa");
  if (reason.trim().length < 3) throw new DomainError("Informe o motivo do cancelamento.");
  await tenantTransaction(ctx, async (tx) => {
    const loaded = await loadOrder(tx, ctx, orderId);
    const { o } = loaded;
    if (o.status === "entregue") throw new DomainError("Pedido entregue não pode ser cancelado. Use o estorno.");
    if (o.status === "estornado") throw new DomainError("Pedido já estornado.");
    if (o.status === "cancelado") throw new DomainError("Pedido já cancelado.");
    if (o.status === "em_rota" && o.driverId) await returnToStore(tx, ctx, loaded, `retorno cancelamento #${o.number}`);
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
  await tenantTransaction(ctx, async (tx) => {
    const { o, items, name } = await loadOrder(tx, ctx, input.orderId);
    if (o.status !== "entregue") throw new DomainError("Só pedidos entregues podem ser estornados.");

    if ((o.paymentMethod === "dinheiro" || o.cashPartCents > 0) && o.shiftId) {
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
        const qty = i.deliveredQuantity ?? i.quantity;
        if (!qty) continue;
        const base = { productId: i.productId, driverId: null, orderId: o.id, reason: `estorno pedido #${o.number}` };
        await move(tx, ctx, { ...base, state: "cheio", quantity: qty }, name(i.productId));
        // o cliente recebe de volta o vazio que tinha entregado na troca
        if (i.returnsEmpty) await move(tx, ctx, { ...base, state: "vazio", quantity: -qty }, name(i.productId));
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
