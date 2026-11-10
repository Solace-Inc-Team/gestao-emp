import { db } from "@/db";
import { tenants, users, products, customers, stockMovements } from "./schema";
import { hashPassword } from "@/lib/password";
import { TERMS_VERSION } from "@/lib/legal";
import type { Ctx } from "@/lib/ctx";
import { createOrder, deliverOrder, dispatchOrder } from "@/domain/orders";
import { openShift, closeShift } from "@/domain/shifts";

export const DEMO_PASSWORD = "demo1234";

// usa as funções de domínio de propósito, assim estoque e caixa da demo fecham certinho
export async function seedDemo() {
  const [t] = await db.insert(tenants).values({ name: "Distribuidora Fonte Azul" }).returning();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const mk = (name: string, email: string, role: "dono" | "atendente" | "caixa" | "entregador") =>
    ({ tenantId: t.id, name, email, role, passwordHash });
  const [dono, atendente, joao, carlos] = await db
    .insert(users)
    .values([
      { ...mk("Marina Souza", "dono@demo.com", "dono"), termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() },
      mk("Paulo Lima", "atendente@demo.com", "atendente"),
      mk("João Pereira", "joao@demo.com", "entregador"),
      mk("Carlos Mendes", "carlos@demo.com", "entregador"),
      mk("Rita Campos", "caixa@demo.com", "caixa"),
    ])
    .returning();

  const ctx: Ctx = { tenantId: t.id, userId: atendente.id, role: "atendente" };
  const owner: Ctx = { tenantId: t.id, userId: dono.id, role: "dono" };

  const [gas, agua, gas45, suporte] = await db
    .insert(products)
    .values([
      { tenantId: t.id, name: "Gás P13", priceCents: 11000, returnable: true, minStock: 10 },
      { tenantId: t.id, name: "Galão de água 20L", priceCents: 1400, returnable: true, minStock: 15 },
      { tenantId: t.id, name: "Gás P45", priceCents: 42000, returnable: true, minStock: 2 },
      { tenantId: t.id, name: "Suporte para galão", priceCents: 2500, returnable: false, minStock: 3 },
    ])
    .returning();

  await db.insert(stockMovements).values(
    [
      [gas, "cheio", 40],
      [gas, "vazio", 6],
      [agua, "cheio", 60],
      [agua, "vazio", 10],
      [gas45, "cheio", 4],
      [suporte, "cheio", 8],
    ].map(([p, state, quantity]) => ({
      tenantId: t.id,
      productId: (p as typeof gas).id,
      state: state as "cheio" | "vazio",
      quantity: quantity as number,
      reason: "inventário inicial",
      userId: dono.id,
    })),
  );

  const cs = await db
    .insert(customers)
    .values(
      [
        ["Ana Ribeiro", "(11) 98811-2034", "Rua das Acácias, 120, Jd. Primavera", "Portão verde"],
        ["Bar do Zé", "(11) 97722-4410", "Av. Brasil, 1500, Centro", "Entregar nos fundos"],
        ["Cláudia Martins", "(11) 99654-0098", "Rua Ipê Roxo, 45, Vila Nova", "Casa 2"],
        ["Restaurante Sabor Caseiro", "(11) 3344-9087", "Rua XV de Novembro, 300, Centro", "Falar com Rose"],
        ["Diego Alves", "(11) 98123-7765", "Rua Palmeiras, 88, Jd. Primavera", ""],
        ["Escola Pequeno Saber", "(11) 3322-1100", "Rua Projetada, 10, Vila Nova", "Recepção, até 17h"],
        ["Fernanda Costa", "(11) 99001-2233", "Travessa Sol, 7, Centro", "Apto 31"],
        ["Padaria Pão Quente", "(11) 3455-6677", "Av. Brasil, 820, Centro", ""],
      ].map(([name, phone, address, reference]) => ({ tenantId: t.id, name, phone, address, reference })),
    )
    .returning();

  const order = (customer: number, items: [typeof gas, number][], paymentMethod: "dinheiro" | "pix" | "cartao" | "fiado", driverId: string | null) =>
    createOrder(ctx, {
      mode: "entrega",
      customerId: cs[customer].id,
      items: items.map(([p, quantity]) => ({ productId: p.id, quantity, returnsEmpty: true })),
      paymentMethod,
      deliveryFeeCents: 0,
      changeForCents: null,
      notes: "",
      driverId,
    });

  // turno anterior do Carlos, fechado com falta de R$ 20
  const old = await openShift(ctx, carlos.id, 5000);
  for (const [c, items, pm] of [
    [1, [[agua, 4]], "dinheiro"],
    [3, [[gas, 2]], "pix"],
    [4, [[gas, 1]], "dinheiro"],
    [7, [[agua, 2]], "dinheiro"],
  ] as const) {
    const o = await order(c, items as unknown as [typeof gas, number][], pm, carlos.id);
    await deliverOrder(ctx, o.id);
  }
  // esperado 50 + 56 + 110 + 28 = 244
  await closeShift(owner, old.id, 22400, "Cliente do Bar do Zé pagou R$ 20 a menos; combinado de acertar amanhã.");

  await openShift(ctx, joao.id, 5000);
  for (const [c, items, pm] of [
    [0, [[gas, 1]], "dinheiro"],
    [2, [[agua, 2]], "pix"],
    [5, [[agua, 6]], "fiado"],
  ] as const) {
    const o = await order(c, items as unknown as [typeof gas, number][], pm, joao.id);
    await deliverOrder(ctx, o.id);
  }
  await order(6, [[gas, 1]], "dinheiro", joao.id);
  const waiting = await order(4, [[agua, 3]], "cartao", null);
  await order(1, [[gas, 1], [agua, 2]], "dinheiro", null);
  await openShift(ctx, carlos.id, 3000);
  await dispatchOrder(ctx, waiting.id, carlos.id);

  await createOrder(ctx, {
    mode: "balcao",
    customerId: null,
    items: [{ productId: agua.id, quantity: 1, returnsEmpty: true }, { productId: suporte.id, quantity: 1, returnsEmpty: false }],
    paymentMethod: "pix",
    deliveryFeeCents: 0,
    changeForCents: null,
    notes: "",
    driverId: null,
  });

  return t;
}
