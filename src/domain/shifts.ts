import { and, eq, sql } from "drizzle-orm";
import { tenantTransaction } from "@/db";
import { shifts, users, orders, stockMovements } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { expectedCash, cashDifference } from "@/lib/cash";
import { audit, move } from "./stock";

export async function openShift(ctx: Ctx, driverId: string, openingCashCents: number) {
  assertRole(ctx, "dono", "atendente");
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
  assertRole(ctx, "dono", "atendente");
  return tenantTransaction(ctx, async (tx) => {
    const [shift] = await tx
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, shiftId), eq(shifts.tenantId, ctx.tenantId)))
      .for("update");
    if (!shift) throw new DomainError("Turno não encontrado.");
    if (shift.status !== "aberto") throw new DomainError("Turno já foi fechado.");

    const shiftOrders = await tx
      .select({ status: orders.status, paymentMethod: orders.paymentMethod, totalCents: orders.totalCents })
      .from(orders)
      .where(eq(orders.shiftId, shift.id));
    if (shiftOrders.some((o) => o.status === "em_rota"))
      throw new DomainError("Há pedidos em rota neste turno. Conclua ou cancele antes do acerto.");

    const expected = expectedCash(shift.openingCashCents, shiftOrders);
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
