import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, scoped, tenantTransaction, type Tx } from "@/db";
import { containerLoans, customers, orderItems, orders, products } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { formatBRL } from "@/lib/money";
import { audit, lockProducts, move } from "./stock";

// Comodato: vasilhame da loja que fica com o cliente sem ele pagar pelo casco. Sai emprestado nos
// pedidos (item marcado como comodato, contado quando o pedido é entregue) ou é lançado à mão, para o
// que já estava emprestado antes do sistema. A caução é o dinheiro que o cliente deixa como garantia e
// recebe de volta quando devolve: não é venda, fica só anotada com o cliente.

/** Quanto cada cliente tem de cada vasilhame em comodato, e a caução em mãos; pedidos entregues mais lançamentos. */
async function saldos(exec: Tx | typeof db, tenantId: string, customerId?: string) {
  const doCliente = customerId ? sql`and c.customer_id = ${customerId}` : sql``;
  const doPedido = customerId ? sql`and o.customer_id = ${customerId}` : sql``;
  const rows = await exec.execute<{ customer_id: string; product_id: string; quantidade: number; caucao: number }>(sql`
    select customer_id, product_id, sum(quantidade)::int as quantidade, sum(caucao)::int as caucao from (
      select o.customer_id, i.product_id, coalesce(i.delivered_quantity, i.quantity) as quantidade, 0 as caucao
        from ${orderItems} i join ${orders} o on o.id = i.order_id
       where i.tenant_id = ${tenantId} and i.loan and o.status = 'entregue' ${doPedido}
      union all
      select c.customer_id, c.product_id, c.quantity, c.deposit_cents
        from ${containerLoans} c
       where c.tenant_id = ${tenantId} ${doCliente}
    ) t group by customer_id, product_id`);
  return rows as unknown as { customer_id: string; product_id: string; quantidade: number; caucao: number }[];
}

/** Comodato de um cliente, por produto, para a tela do cliente e o pedido novo. */
export const comodatoDoCliente = scoped(async function comodatoDoCliente(tenantId: string, customerId: string) {
  const rows = await saldos(db, tenantId, customerId);
  const prods = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.tenantId, tenantId));
  const itens = rows
    .filter((r) => r.quantidade !== 0)
    .map((r) => ({ productId: r.product_id, nome: prods.find((p) => p.id === r.product_id)?.name ?? "produto", quantidade: r.quantidade }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return { itens, caucaoCents: rows.reduce((s, r) => s + r.caucao, 0) };
});

/** Total em comodato de cada produto, somando todos os clientes: entra na conta dos vasilhames do estoque. */
export const comodatoPorProduto = scoped(async function comodatoPorProduto(tenantId: string) {
  const rows = await saldos(db, tenantId);
  const total = new Map<string, number>();
  for (const r of rows) total.set(r.product_id, (total.get(r.product_id) ?? 0) + r.quantidade);
  return total;
});

export const registroSchema = z.object({
  customerId: z.uuid(),
  productId: z.uuid(),
  quantity: z.int().min(1, "Informe a quantidade.").max(999, "Quantidade muito alta."),
  depositCents: z.int().min(0).max(100_000_00, "Caução muito alta."),
  depositMethod: z.enum(["dinheiro", "pix", "cartao"]).nullable(),
  note: z.string().trim().min(3, "Diga de onde vem esse comodato (ex.: contrato antigo).").max(200),
});

async function confere(tx: Tx, ctx: Ctx, customerId: string, productId: string) {
  const [c] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, ctx.tenantId)));
  if (!c) throw new DomainError("Cliente não encontrado.");
  const [p] = await lockProducts(tx, ctx, [productId]);
  if (!p) throw new DomainError("Produto não encontrado.");
  if (!p.returnable) throw new DomainError(`${p.name} não tem vasilhame retornável.`);
  return p;
}

/**
 * Comodato que já existia antes do sistema (contrato antigo): entra no saldo do cliente sem mexer no
 * estoque da loja, porque o casco já estava com ele. Só o dono lança, com a senha (é ajuste).
 */
export async function registrarComodato(ctx: Ctx, raw: z.input<typeof registroSchema>) {
  assertRole(ctx, "dono");
  const input = registroSchema.parse(raw);
  if (input.depositCents > 0 && !input.depositMethod) throw new DomainError("Diga como a caução foi paga.");
  return tenantTransaction(ctx, async (tx) => {
    const p = await confere(tx, ctx, input.customerId, input.productId);
    const [l] = await tx
      .insert(containerLoans)
      .values({
        tenantId: ctx.tenantId,
        customerId: input.customerId,
        productId: input.productId,
        quantity: input.quantity,
        depositCents: input.depositCents,
        depositMethod: input.depositCents > 0 ? input.depositMethod : null,
        note: input.note,
        userId: ctx.userId,
      })
      .returning({ id: containerLoans.id });
    await audit(tx, ctx, "cliente.comodato", "customer", input.customerId, {
      product: p.name,
      quantity: input.quantity,
      deposit: input.depositCents || undefined,
      note: input.note,
    });
    return l;
  });
}

export const devolucaoSchema = z.object({
  customerId: z.uuid(),
  productId: z.uuid(),
  quantity: z.int().min(1, "Informe quantos vasilhames voltaram.").max(999, "Quantidade muito alta."),
  refundCents: z.int().min(0).max(100_000_00, "Valor muito alto."),
  note: z.string().trim().max(200),
});

/**
 * O cliente devolve vasilhames do comodato: saem do saldo dele e voltam para a loja como vazios.
 * Se ele tinha deixado caução, a loja devolve o dinheiro (até o que tem em mãos dele).
 */
export async function devolverVasilhame(ctx: Ctx, raw: z.input<typeof devolucaoSchema>) {
  assertRole(ctx, "dono", "caixa", "atendente");
  const input = devolucaoSchema.parse(raw);
  return tenantTransaction(ctx, async (tx) => {
    const p = await confere(tx, ctx, input.customerId, input.productId);
    const meus = await saldos(tx, ctx.tenantId, input.customerId);
    const tem = meus.find((r) => r.product_id === input.productId)?.quantidade ?? 0;
    if (input.quantity > tem) throw new DomainError(`O cliente tem ${tem} ${p.name} em comodato.`);
    const caucao = meus.reduce((s, r) => s + r.caucao, 0);
    if (input.refundCents > caucao) throw new DomainError(`A caução em mãos deste cliente é ${formatBRL(caucao)}.`);
    await tx.insert(containerLoans).values({
      tenantId: ctx.tenantId,
      customerId: input.customerId,
      productId: input.productId,
      quantity: -input.quantity,
      depositCents: -input.refundCents,
      note: input.note,
      userId: ctx.userId,
    });
    await move(tx, ctx, { productId: p.id, state: "vazio", driverId: null, quantity: input.quantity, reason: "devolução de comodato" }, p.name);
    await audit(tx, ctx, "cliente.devolver_comodato", "customer", input.customerId, {
      product: p.name,
      quantity: input.quantity,
      refund: input.refundCents || undefined,
    });
  });
}
