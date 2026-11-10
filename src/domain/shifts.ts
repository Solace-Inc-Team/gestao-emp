import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { tenantTransaction, type Tx } from "@/db";
import { shifts, users, orders, stockMovements, cashEntries, expenses } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { expectedCash, cashDifference } from "@/lib/cash";
import { formatBRL } from "@/lib/money";
import { todayISO } from "@/lib/period";
import { audit, move } from "./stock";
import { expenseCategories } from "./expenses";

// quem confere o dinheiro do entregador: o dono ou o caixa, nunca quem só atende
const CONFERENTE = ["dono", "caixa"] as const;

async function handedOver(tx: Tx, shiftId: string) {
  const [r] = await tx
    .select({ total: sql<number>`coalesce(sum(${cashEntries.amountCents}), 0)::int` })
    .from(cashEntries)
    .where(and(eq(cashEntries.shiftId, shiftId), isNull(cashEntries.voidedAt)));
  return r.total;
}

async function lockOpenShift(tx: Tx, ctx: Ctx, shiftId: string) {
  const [shift] = await tx
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), eq(shifts.tenantId, ctx.tenantId)))
    .for("update");
  if (!shift) throw new DomainError("Turno não encontrado.");
  if (shift.status !== "aberto") throw new DomainError("Turno já foi fechado.");
  return shift;
}

const shiftOrdersOf = (tx: Tx, shiftId: string) =>
  tx
    .select({ status: orders.status, paymentMethod: orders.paymentMethod, totalCents: orders.totalCents })
    .from(orders)
    .where(eq(orders.shiftId, shiftId));

export const cashEntrySchema = z.object({
  shiftId: z.uuid(),
  kind: z.enum(["repasse", "saida"]),
  amountCents: z.int().min(1, "Informe o valor."),
  note: z.string().trim().max(160, "A observação pode ter até 160 letras."),
  category: z.string(),
});

/**
 * Repasse: o entregador deixa parte do dinheiro no caixa no meio do turno.
 * Saída: gasto autorizado pago com o dinheiro das entregas (combustível, por exemplo); vira despesa da empresa.
 * Os dois diminuem o que ele deve apresentar no acerto.
 */
export async function addCashEntry(ctx: Ctx, input: z.infer<typeof cashEntrySchema>) {
  assertRole(ctx, ...CONFERENTE);
  if (input.kind === "saida") {
    if (!(input.category in expenseCategories) || input.category === "estorno") throw new DomainError("Escolha o tipo do gasto.");
    if (input.note.length < 2) throw new DomainError("Descreva o gasto.");
  }
  return tenantTransaction(ctx, async (tx) => {
    const shift = await lockOpenShift(tx, ctx, input.shiftId);
    const inHand = expectedCash(shift.openingCashCents, await shiftOrdersOf(tx, shift.id), await handedOver(tx, shift.id));
    if (input.amountCents > inHand)
      throw new DomainError(`Pelo sistema o entregador tem ${formatBRL(inHand)} em dinheiro. Confira as entregas antes de lançar um valor maior.`);

    let expenseId: string | null = null;
    if (input.kind === "saida") {
      const [e] = await tx
        .insert(expenses)
        .values({
          tenantId: ctx.tenantId,
          category: input.category,
          description: input.note,
          amountCents: input.amountCents,
          method: "dinheiro",
          paidOn: todayISO(),
          createdBy: ctx.userId,
        })
        .returning({ id: expenses.id });
      expenseId = e.id;
    }
    const [entry] = await tx
      .insert(cashEntries)
      .values({ tenantId: ctx.tenantId, shiftId: shift.id, kind: input.kind, amountCents: input.amountCents, note: input.note, expenseId, createdBy: ctx.userId })
      .returning();
    await audit(tx, ctx, `turno.${input.kind}`, "shift", shift.id, { entryId: entry.id, amountCents: input.amountCents });
    return entry;
  });
}

export async function voidCashEntry(ctx: Ctx, entryId: string, reason: string) {
  assertRole(ctx, "dono");
  if (reason.trim().length < 3) throw new DomainError("Informe o motivo do estorno.");
  await tenantTransaction(ctx, async (tx) => {
    const [e] = await tx
      .select()
      .from(cashEntries)
      .where(and(eq(cashEntries.id, entryId), eq(cashEntries.tenantId, ctx.tenantId)));
    if (!e) throw new DomainError("Lançamento não encontrado.");
    // trava o turno antes de mexer: o acerto não pode fechar com a conta mudando
    const [open] = await tx
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.id, e.shiftId), eq(shifts.status, "aberto")))
      .for("update");
    if (!open) throw new DomainError("O acerto deste turno já foi fechado. O lançamento não pode mais ser estornado.");
    const voided = { voidedAt: new Date(), voidedBy: ctx.userId, voidReason: reason.trim() };
    const [done] = await tx
      .update(cashEntries)
      .set(voided)
      .where(and(eq(cashEntries.id, e.id), isNull(cashEntries.voidedAt)))
      .returning({ id: cashEntries.id });
    if (!done) throw new DomainError("Lançamento já estornado.");
    if (e.expenseId) await tx.update(expenses).set(voided).where(eq(expenses.id, e.expenseId));
    await audit(tx, ctx, "turno.estornar_lancamento", "shift", e.shiftId, { entryId: e.id, reason });
  });
}

export const resolutions = {
  recebido: "Entregador pagou a diferença",
  descontado: "Será descontado do entregador",
  erro_contagem: "Erro de contagem ou de lançamento",
  assumido: "A empresa assume a diferença",
  sobra: "Sobra recolhida ao caixa",
} as const;

/** O dono encerra a pendência dizendo o que foi feito da diferença. O acerto em si não muda. */
export async function resolveDifference(ctx: Ctx, shiftId: string, resolution: string, notes: string) {
  assertRole(ctx, "dono");
  if (!(resolution in resolutions)) throw new DomainError("Escolha o que foi feito da diferença.");
  if (notes.trim().length < 3) throw new DomainError("Explique em poucas palavras como a diferença foi resolvida.");
  await tenantTransaction(ctx, async (tx) => {
    const [s] = await tx
      .update(shifts)
      .set({ resolution, resolutionNotes: notes.trim(), resolvedBy: ctx.userId, resolvedAt: new Date() })
      .where(
        and(
          eq(shifts.id, shiftId),
          eq(shifts.tenantId, ctx.tenantId),
          eq(shifts.status, "fechado"),
          sql`${shifts.differenceCents} <> 0`,
          isNull(shifts.resolvedAt),
        ),
      )
      .returning({ id: shifts.id });
    if (!s) throw new DomainError("Este acerto não tem diferença pendente.");
    await audit(tx, ctx, "turno.resolver_diferenca", "shift", s.id, { resolution, notes });
  });
}

export async function openShift(ctx: Ctx, driverId: string, openingCashCents: number) {
  assertRole(ctx, "dono", "atendente", "caixa");
  return tenantTransaction(ctx, async (tx) => {
    const [driver] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, driverId), eq(users.tenantId, ctx.tenantId), eq(users.role, "entregador"), eq(users.active, true)))
      .for("update"); // dois cliques em "Abrir turno" não abrem dois turnos
    if (!driver) throw new DomainError("Entregador não encontrado.");
    const [open] = await tx
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.tenantId, ctx.tenantId), eq(shifts.driverId, driverId), eq(shifts.status, "aberto")));
    if (open) throw new DomainError(`${driver.name} já tem um turno aberto.`);
    const [shift] = await tx
      .insert(shifts)
      .values({ tenantId: ctx.tenantId, driverId, openingCashCents, openedBy: ctx.userId })
      .returning();
    await audit(tx, ctx, "turno.abrir", "shift", shift.id, { driverId, openingCashCents });
    return shift;
  });
}

export async function closeShift(ctx: Ctx, shiftId: string, countedCashCents: number, notes: string) {
  assertRole(ctx, ...CONFERENTE);
  return tenantTransaction(ctx, async (tx) => {
    const shift = await lockOpenShift(tx, ctx, shiftId);
    const shiftOrders = await shiftOrdersOf(tx, shift.id);
    if (shiftOrders.some((o) => o.status === "em_rota"))
      throw new DomainError("Há pedidos em rota neste turno. Conclua ou cancele antes do acerto.");

    const expected = expectedCash(shift.openingCashCents, shiftOrders, await handedOver(tx, shift.id));
    const diff = cashDifference(expected, countedCashCents);
    if (diff !== 0 && notes.trim().length < 3)
      throw new DomainError("Há diferença no caixa: explique na observação (ao menos 3 letras).");

    // o que ficou com o entregador volta pra loja
    const held = await tx
      .select({
        productId: stockMovements.productId,
        state: stockMovements.state,
        qty: sql<number>`sum(${stockMovements.quantity})::int`,
      })
      .from(stockMovements)
      .where(and(eq(stockMovements.tenantId, ctx.tenantId), eq(stockMovements.driverId, shift.driverId)))
      .groupBy(stockMovements.productId, stockMovements.state);
    for (const h of held.filter((h) => h.qty > 0)) {
      const base = { productId: h.productId, state: h.state, shiftId: shift.id, reason: "devolução no acerto" };
      await move(tx, ctx, { ...base, driverId: shift.driverId, quantity: -h.qty });
      await move(tx, ctx, { ...base, driverId: null, quantity: h.qty });
    }

    const [closed] = await tx
      .update(shifts)
      .set({
        status: "fechado",
        expectedCashCents: expected,
        countedCashCents,
        differenceCents: diff,
        closingNotes: notes.trim(),
        closedBy: ctx.userId,
        closedAt: new Date(),
      })
      .where(eq(shifts.id, shift.id))
      .returning();
    await audit(tx, ctx, "turno.acerto", "shift", shift.id, { expected, countedCashCents, diff, returned: held });
    return closed;
  });
}
