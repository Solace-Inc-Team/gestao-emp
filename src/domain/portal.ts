import { z } from "zod";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, withTenant } from "@/db";
import { customers, products, tenants, users } from "@/db/schema";
import { type Ctx, DomainError } from "@/lib/ctx";
import { pixPayload } from "@/lib/pix";
import { createOrder } from "./orders";
import { audit } from "./stock";

/** Empresa do portal público. Só aparece se estiver ativa e com o portal ligado pelo dono. */
export async function portalTenant(slug: string) {
  const [t] = await db
    .select({ id: tenants.id, name: tenants.name, pixKey: tenants.pixKey, pixName: tenants.pixName, pixCity: tenants.pixCity })
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.active, true), eq(tenants.portalEnabled, true)));
  return t ?? null;
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
export async function placePortalOrder(tenantId: string, input: z.infer<typeof portalOrderSchema>) {
  // o pedido precisa de um responsável na equipe: fica em nome do dono, e a origem "portal" mostra que veio do cliente
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "dono"), eq(users.active, true)))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!owner) throw new DomainError("Esta loja não está recebendo pedidos agora.");
  const ctx: Ctx = { tenantId, userId: owner.id, role: "dono" };
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
      // endereço digitado agora vale para esta entrega, mesmo que o cadastro tenha outro
      const order = await createOrder(ctx, {
        mode: "entrega",
        customerId,
        items: input.items,
        paymentMethod: input.paymentMethod,
        deliveryFeeCents: 0,
        changeForCents: input.paymentMethod === "dinheiro" ? input.changeForCents : null,
        notes: [input.notes, known ? `Entregar em: ${input.address}${input.reference ? ` (${input.reference})` : ""}` : ""].filter(Boolean).join(" | "),
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
