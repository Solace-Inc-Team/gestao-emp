import { z } from "zod";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, withTenant } from "@/db";
import { branches, customers, orderItems, orders, products, tenants, users } from "@/db/schema";
import { type Ctx, DomainError, isUuid } from "@/lib/ctx";
import { pixPayload } from "@/lib/pix";
import { createOrder } from "./orders";
import { audit } from "./stock";

/**
 * Empresa do portal público. Só aparece se estiver ativa e com o portal ligado pelo dono.
 * Cada filial tem seu link (?filial=<slug>); sem filial, ou com uma que não existe mais, o pedido vai para a principal.
 */
export async function portalTenant(slug: string, filial?: string) {
  const [t] = await db
    .select({ id: tenants.id, name: tenants.name, pixKey: tenants.pixKey, pixName: tenants.pixName, pixCity: tenants.pixCity })
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.active, true), eq(tenants.portalEnabled, true)));
  if (!t) return null;
  const lojas = await db
    .select({ id: branches.id, name: branches.name, slug: branches.slug, main: branches.main })
    .from(branches)
    .where(and(eq(branches.tenantId, t.id), eq(branches.active, true)));
  const loja = lojas.find((b) => filial && b.slug === filial) ?? lojas.find((b) => b.main) ?? lojas[0];
  // com uma filial só, o nome dela não aparece para o cliente
  return { ...t, branchId: loja.id, branchName: lojas.length > 1 ? loja.name : null };
}

export const portalProducts = (tenantId: string) =>
  withTenant(tenantId, () =>
    db
      .select({ id: products.id, name: products.name, priceCents: products.priceCents, returnable: products.returnable, containerPriceCents: products.containerPriceCents })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.active, true)))
      .orderBy(asc(products.name)),
  );

export const portalOrderSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120, "O nome pode ter até 120 letras."),
  phone: z
    .string()
    .trim()
    .max(30, "Telefone muito longo.")
    .refine((p) => p.replace(/\D/g, "").length >= 10, "Informe o telefone com DDD."),
  address: z.string().trim().min(5, "Informe o endereço de entrega.").max(200, "O endereço pode ter até 200 letras."),
  reference: z.string().trim().max(200, "A referência pode ter até 200 letras."),
  items: z
    .array(z.object({ productId: z.uuid(), quantity: z.int().min(1).max(20, "No máximo 20 unidades por item."), returnsEmpty: z.boolean() }))
    .min(1, "Escolha ao menos um produto."),
  paymentMethod: z.enum(["dinheiro", "pix", "cartao"], { message: "Escolha como vai pagar." }),
  changeForCents: z.int().min(0).max(100_000_00).nullable(),
  notes: z.string().trim().max(300, "A observação pode ter até 300 letras."),
});

/**
 * Pedido feito pelo próprio cliente no link da empresa. Entra na fila como qualquer outro, com origem "portal".
 * Cliente é reconhecido pelo telefone; se não existir, é cadastrado.
 */
export async function placePortalOrder(tenantId: string, branchId: string, input: z.infer<typeof portalOrderSchema>) {
  // o pedido precisa de um responsável na equipe: fica em nome do dono, e a origem "portal" mostra que veio do cliente
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "dono"), eq(users.active, true)))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!owner) throw new DomainError("Esta loja não está recebendo pedidos agora.");
  const ctx: Ctx = { tenantId, userId: owner.id, role: "dono", branchId };
  const digits = input.phone.replace(/\D/g, "");

  return withTenant(tenantId, () =>
    db.transaction(async (tx) => {
      const [known] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            isNull(customers.anonymizedAt),
            sql`right(regexp_replace(${customers.phone}, '\\D', '', 'g'), 11) = right(${digits}, 11)`,
          ),
        )
        .limit(1);
      let customerId = known?.id;
      if (!customerId) {
        const [c] = await tx
          .insert(customers)
          .values({ tenantId, name: input.name, phone: input.phone, address: input.address, reference: input.reference })
          .returning({ id: customers.id });
        customerId = c.id;
        await audit(tx, ctx, "cliente.criar", "customer", c.id, { origin: "portal" });
      }
      // o que o cliente digitou vale para esta entrega; se o telefone já era de alguém, a loja confere antes de sair
      const order = await createOrder(ctx, {
        mode: "entrega",
        customerId,
        items: input.items,
        paymentMethod: input.paymentMethod,
        deliveryFeeCents: 0,
        changeForCents: input.paymentMethod === "dinheiro" ? input.changeForCents : null,
        address: input.address,
        reference: input.reference,
        notes: [input.notes, known ? `Confirmar com o cliente: pedido do site em nome de "${input.name}"` : ""].filter(Boolean).join(" | "),
        driverId: null,
        origin: "portal",
      });
      return order;
    }),
  );
}

/** Código Pix do pedido, quando a empresa cadastrou a chave. */
export function orderPix(t: { pixKey: string; pixName: string; pixCity: string }, order: { number: number; totalCents: number }) {
  if (!t.pixKey) return null;
  return pixPayload({ key: t.pixKey, name: t.pixName, city: t.pixCity, amountCents: order.totalCents, txid: `PED${order.number}` });
}

/**
 * O pedido como o cliente vê pelo link de acompanhamento: sem login, achado pelo código secreto do pedido
 * dentro da loja do endereço. Mostra só o que o cliente precisa (itens, situação, total, primeiro nome do
 * entregador); endereço e telefone ficam de fora, porque o link pode ser repassado.
 * Vale também para pedido feito por telefone ou balcão, então não depende do portal estar ligado.
 */
export async function pedidoAcompanhado(slug: string, codigo: string) {
  if (!isUuid(codigo)) return null;
  const [t] = await db
    .select({ id: tenants.id, name: tenants.name, pixKey: tenants.pixKey, pixName: tenants.pixName, pixCity: tenants.pixCity })
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.active, true)));
  if (!t) return null;
  return withTenant(t.id, async () => {
    const [o] = await db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        totalCents: orders.totalCents,
        cashPartCents: orders.cashPartCents,
        pixConfirmedAt: orders.pixConfirmedAt,
        occurrence: orders.occurrence,
        occurrenceAt: orders.occurrenceAt,
        createdAt: orders.createdAt,
        dispatchedAt: orders.dispatchedAt,
        deliveredAt: orders.deliveredAt,
        driverName: users.name,
      })
      .from(orders)
      .leftJoin(users, eq(users.id, orders.driverId))
      .where(and(eq(orders.tenantId, t.id), eq(orders.trackingId, codigo)));
    if (!o) return null;
    const { driverName, id, ...pedido } = o;
    const itens = await db
      .select({ nome: products.name, quantidade: orderItems.quantity })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(and(eq(orderItems.tenantId, t.id), eq(orderItems.orderId, id)))
      .orderBy(asc(products.name));
    return { loja: t, pedido: { ...pedido, entregador: driverName?.split(" ")[0] ?? null }, itens };
  });
}
