import { z } from "zod";
import { and, desc, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses, users } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { audit } from "./stock";

export const expenseCategories = {
  combustivel: "Combustível",
  fornecedor: "Fornecedor",
  salarios: "Salários e diárias",
  manutencao: "Manutenção",
  aluguel: "Aluguel e contas",
  impostos: "Impostos e taxas",
  outros: "Outros",
  estorno: "Estorno de venda",
} as const;
export type ExpenseCategory = keyof typeof expenseCategories;

export const expenseSchema = z.object({
  // "estorno" só nasce do estorno de pedido, nunca à mão
  category: z.enum(["combustivel", "fornecedor", "salarios", "manutencao", "aluguel", "impostos", "outros"], {
    message: "Escolha a categoria.",
  }),
  description: z.string().trim().min(2, "Descreva a despesa.").max(160),
  amountCents: z.int().min(1, "Informe o valor."),
  method: z.enum(["dinheiro", "pix", "cartao", "boleto"]),
  paidOn: z.iso.date("Data inválida."),
});

export async function createExpense(ctx: Ctx, input: z.infer<typeof expenseSchema>) {
  assertRole(ctx, "dono", "atendente");
  return db.transaction(async (tx) => {
    const [e] = await tx.insert(expenses).values({ ...input, tenantId: ctx.tenantId, createdBy: ctx.userId }).returning();
    await audit(tx, ctx, "despesa.criar", "expense", e.id, input);
    return e;
  });
}

export async function voidExpense(ctx: Ctx, expenseId: string, reason: string) {
  assertRole(ctx, "dono");
  if (reason.trim().length < 3) throw new DomainError("Informe o motivo do cancelamento.");
  await db.transaction(async (tx) => {
    const [e] = await tx
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.tenantId, ctx.tenantId)))
      .for("update");
    if (!e) throw new DomainError("Despesa não encontrada.");
    if (e.voidedAt) throw new DomainError("Despesa já cancelada.");
    if (e.orderId) throw new DomainError("Esta saída é a devolução de um pedido estornado e não pode ser cancelada.");
    await tx
      .update(expenses)
      .set({ voidedAt: new Date(), voidedBy: ctx.userId, voidReason: reason.trim() })
      .where(eq(expenses.id, e.id));
    await audit(tx, ctx, "despesa.cancelar", "expense", e.id, { reason });
  });
}

/** Despesas do período (datas YYYY-MM-DD, inclusivas), canceladas junto para o histórico. */
export function listExpenses(tenantId: string, fromStr: string, toStr: string) {
  return db
    .select({
      id: expenses.id,
      category: expenses.category,
      description: expenses.description,
      amountCents: expenses.amountCents,
      method: expenses.method,
      paidOn: expenses.paidOn,
      orderId: expenses.orderId,
      voidedAt: expenses.voidedAt,
      voidReason: expenses.voidReason,
      by: users.name,
    })
    .from(expenses)
    .innerJoin(users, eq(users.id, expenses.createdBy))
    .where(and(eq(expenses.tenantId, tenantId), gte(expenses.paidOn, fromStr), lte(expenses.paidOn, toStr)))
    .orderBy(desc(expenses.paidOn), desc(expenses.createdAt));
}

// excludeRefunds: no resultado do período a venda estornada já saiu das vendas; contar a devolução seria descontar duas vezes
export async function expensesTotal(tenantId: string, fromStr: string, toStr: string, excludeRefunds = false) {
  const [r] = await db
    .select({ total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int` })
    .from(expenses)
    .where(
      and(
        eq(expenses.tenantId, tenantId),
        isNull(expenses.voidedAt),
        gte(expenses.paidOn, fromStr),
        lte(expenses.paidOn, toStr),
        excludeRefunds ? ne(expenses.category, "estorno") : undefined,
      ),
    );
  return r.total;
}
