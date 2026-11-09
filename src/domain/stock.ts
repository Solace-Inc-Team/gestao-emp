import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { products, stockMovements, auditLog } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";

type State = "cheio" | "vazio";

export async function audit(tx: Tx, ctx: Ctx, action: string, entity: string, entityId: string, data?: unknown) {
  await tx.insert(auditLog).values({ tenantId: ctx.tenantId, userId: ctx.userId, action, entity, entityId, data });
}

// FOR UPDATE nos produtos: duas vendas simultâneas não passam juntas pela checagem de saldo
export async function lockProducts(tx: Tx, ctx: Ctx, productIds: string[]) {
  return tx
    .select()
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, productIds)))
    .for("update");
}

export async function balanceOf(tx: Tx, ctx: Ctx, productId: string, state: State, driverId: string | null) {
  const [row] = await tx
    .select({ qty: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)::int` })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.tenantId, ctx.tenantId),
        eq(stockMovements.productId, productId),
        eq(stockMovements.state, state),
        driverId ? eq(stockMovements.driverId, driverId) : isNull(stockMovements.driverId),
      ),
    );
  return row.qty;
}

type Move = {
  productId: string;
  state: State;
  driverId: string | null;
  quantity: number;
  reason: string;
  orderId?: string;
  shiftId?: string;
};

export async function move(tx: Tx, ctx: Ctx, m: Move, productName = "produto") {
  if (m.quantity === 0) return;
  if (m.quantity < 0) {
    const have = await balanceOf(tx, ctx, m.productId, m.state, m.driverId);
    if (have + m.quantity < 0) {
      const onde = m.driverId ? "com o entregador" : "na loja";
      throw new DomainError(`Estoque insuficiente de ${productName} (${m.state}) ${onde}: há ${have}.`);
    }
  }
  await tx.insert(stockMovements).values({ ...m, tenantId: ctx.tenantId, userId: ctx.userId });
}

export async function receivePurchase(
  ctx: Ctx,
  input: { productId: string; full: number; emptiesReturned: number; note: string },
) {
  assertRole(ctx, "dono", "atendente");
  if (input.full < 1) throw new DomainError("Informe a quantidade recebida.");
  await db.transaction(async (tx) => {
    const [p] = await lockProducts(tx, ctx, [input.productId]);
    if (!p) throw new DomainError("Produto não encontrado.");
    const reason = `compra${input.note ? `: ${input.note}` : ""}`;
    await move(tx, ctx, { productId: p.id, state: "cheio", driverId: null, quantity: input.full, reason }, p.name);
    if (p.returnable && input.emptiesReturned > 0)
      await move(tx, ctx, { productId: p.id, state: "vazio", driverId: null, quantity: -input.emptiesReturned, reason }, p.name);
    await audit(tx, ctx, "estoque.compra", "product", p.id, input);
  });
}

export async function adjustStock(ctx: Ctx, input: { productId: string; state: State; counted: number; reason: string }) {
  assertRole(ctx, "dono");
  if (input.counted < 0) throw new DomainError("A contagem não pode ser negativa.");
  if (input.reason.trim().length < 3) throw new DomainError("Informe o motivo do ajuste.");
  await db.transaction(async (tx) => {
    const [p] = await lockProducts(tx, ctx, [input.productId]);
    if (!p) throw new DomainError("Produto não encontrado.");
    const have = await balanceOf(tx, ctx, p.id, input.state, null);
    const delta = input.counted - have;
    if (delta === 0) return;
    await move(tx, ctx, { productId: p.id, state: input.state, driverId: null, quantity: delta, reason: `ajuste: ${input.reason}` }, p.name);
    await audit(tx, ctx, "estoque.ajuste", "product", p.id, { ...input, before: have, delta });
  });
}
