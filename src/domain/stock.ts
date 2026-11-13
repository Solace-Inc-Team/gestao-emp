import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { tenantTransaction, type Tx } from "@/db";
import { z } from "zod";
import { products, stockMovements, auditLog, suppliers, expenses } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { todayISO } from "@/lib/period";

type State = "cheio" | "vazio" | "avariado";

export async function audit(tx: Tx, ctx: Pick<Ctx, "tenantId" | "userId">, action: string, entity: string, entityId: string, data?: unknown) {
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
        eq(stockMovements.branchId, ctx.branchId),
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
  supplierId?: string;
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
  await tx.insert(stockMovements).values({ ...m, tenantId: ctx.tenantId, branchId: ctx.branchId, userId: ctx.userId });
}

export async function receivePurchase(
  ctx: Ctx,
  input: {
    productId: string;
    full: number;
    emptiesReturned: number;
    note: string;
    supplierId?: string | null;
    /** valor pago na compra; quando informado, entra nas despesas */
    costCents?: number | null;
    costMethod?: "dinheiro" | "pix" | "cartao" | "boleto";
  },
) {
  assertRole(ctx, "dono", "atendente", "caixa");
  if (input.full < 1) throw new DomainError("Informe a quantidade recebida.");
  await tenantTransaction(ctx, async (tx) => {
    const [p] = await lockProducts(tx, ctx, [input.productId]);
    if (!p) throw new DomainError("Produto não encontrado.");
    let supplier: { id: string; name: string } | undefined;
    if (input.supplierId) {
      [supplier] = await tx
        .select({ id: suppliers.id, name: suppliers.name })
        .from(suppliers)
        .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.tenantId, ctx.tenantId)));
      if (!supplier) throw new DomainError("Fornecedor não encontrado.");
    }
    const detail = [supplier?.name, input.note].filter(Boolean).join(", ");
    const reason = `compra${detail ? `: ${detail}` : ""}`;
    const base = { productId: p.id, driverId: null, reason, supplierId: supplier?.id };
    await move(tx, ctx, { ...base, state: "cheio", quantity: input.full }, p.name);
    if (p.returnable && input.emptiesReturned > 0) await move(tx, ctx, { ...base, state: "vazio", quantity: -input.emptiesReturned }, p.name);
    if (input.costCents) {
      await tx.insert(expenses).values({
        tenantId: ctx.tenantId,
        branchId: ctx.branchId,
        category: "fornecedor",
        description: `Compra: ${input.full} x ${p.name}${supplier ? ` (${supplier.name})` : ""}`.slice(0, 160),
        amountCents: input.costCents,
        method: input.costMethod ?? "boleto",
        paidOn: todayISO(),
        createdBy: ctx.userId,
      });
    }
    await audit(tx, ctx, "estoque.compra", "product", p.id, input);
  });
}

/** Tira da venda um cheio ou vazio com defeito (vazando, amassado, lacre rompido). Continua contado, como avariado. */
export async function markDamaged(ctx: Ctx, input: { productId: string; from: "cheio" | "vazio"; quantity: number; note: string }) {
  assertRole(ctx, "dono", "atendente", "caixa");
  if (input.quantity < 1) throw new DomainError("Informe a quantidade.");
  if (input.note.trim().length < 3) throw new DomainError("Descreva o defeito.");
  await tenantTransaction(ctx, async (tx) => {
    const [p] = await lockProducts(tx, ctx, [input.productId]);
    if (!p) throw new DomainError("Produto não encontrado.");
    const base = { productId: p.id, driverId: null, reason: `avaria: ${input.note.trim()}` };
    await move(tx, ctx, { ...base, state: input.from, quantity: -input.quantity }, p.name);
    await move(tx, ctx, { ...base, state: "avariado", quantity: input.quantity }, p.name);
    await audit(tx, ctx, "estoque.avaria", "product", p.id, input);
  });
}

/**
 * Inventário: a contagem física de tudo que está na loja, de uma vez.
 * Cada diferença vira um ajuste próprio; o que bateu não gera movimento.
 */
export async function runInventory(ctx: Ctx, counts: { productId: string; state: State; counted: number }[], note: string) {
  assertRole(ctx, "dono");
  if (!counts.length) throw new DomainError("Nenhuma contagem informada.");
  if (counts.some((c) => !Number.isInteger(c.counted) || c.counted < 0)) throw new DomainError("A contagem não pode ser negativa.");
  return tenantTransaction(ctx, async (tx) => {
    const prods = await lockProducts(tx, ctx, [...new Set(counts.map((c) => c.productId))]);
    const diffs: { product: string; state: State; before: number; counted: number }[] = [];
    for (const c of counts) {
      const p = prods.find((x) => x.id === c.productId);
      if (!p) throw new DomainError("Produto não encontrado.");
      const have = await balanceOf(tx, ctx, p.id, c.state, null);
      if (have === c.counted) continue;
      await move(tx, ctx, { productId: p.id, state: c.state, driverId: null, quantity: c.counted - have, reason: `inventário${note.trim() ? `: ${note.trim()}` : ""}` }, p.name);
      diffs.push({ product: p.name, state: c.state, before: have, counted: c.counted });
    }
    await audit(tx, ctx, "estoque.inventario", "tenant", ctx.tenantId, { counted: counts.length, diffs, note: note.trim() });
    return diffs;
  });
}

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(120, "O nome pode ter até 120 letras."),
  phone: z.string().trim().max(30, "Telefone muito longo."),
  notes: z.string().trim().max(300, "A observação pode ter até 300 letras."),
  active: z.boolean(),
});

export async function saveSupplier(ctx: Ctx, input: z.infer<typeof supplierSchema>, id?: string) {
  assertRole(ctx, "dono", "atendente", "caixa");
  return tenantTransaction(ctx, async (tx) => {
    if (id) {
      const [s] = await tx.update(suppliers).set(input).where(and(eq(suppliers.id, id), eq(suppliers.tenantId, ctx.tenantId))).returning();
      if (!s) throw new DomainError("Fornecedor não encontrado.");
      await audit(tx, ctx, "fornecedor.editar", "supplier", s.id, input);
      return s;
    }
    const [s] = await tx.insert(suppliers).values({ ...input, tenantId: ctx.tenantId }).returning();
    await audit(tx, ctx, "fornecedor.criar", "supplier", s.id);
    return s;
  });
}

export async function adjustStock(ctx: Ctx, input: { productId: string; state: State; counted: number; reason: string }) {
  assertRole(ctx, "dono");
  if (input.counted < 0) throw new DomainError("A contagem não pode ser negativa.");
  if (input.reason.trim().length < 3) throw new DomainError("Informe o motivo do ajuste.");
  await tenantTransaction(ctx, async (tx) => {
    const [p] = await lockProducts(tx, ctx, [input.productId]);
    if (!p) throw new DomainError("Produto não encontrado.");
    const have = await balanceOf(tx, ctx, p.id, input.state, null);
    const delta = input.counted - have;
    if (delta === 0) return;
    await move(tx, ctx, { productId: p.id, state: input.state, driverId: null, quantity: delta, reason: `ajuste: ${input.reason}` }, p.name);
    await audit(tx, ctx, "estoque.ajuste", "product", p.id, { ...input, before: have, delta });
  });
}
