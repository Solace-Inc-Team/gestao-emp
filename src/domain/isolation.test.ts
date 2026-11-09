// Garante que uma empresa não lê nem altera dados de outra.
// Precisa de um Postgres de pé (o do `npm run dev` serve): cria e apaga o banco gestao_test.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

const ADMIN_URL = process.env.TEST_PG_URL ?? "postgres://app:app@localhost:5433/postgres";
const TEST_DB = "gestao_test";

const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });

// importados depois que DATABASE_URL aponta pro banco de teste
let m: {
  db: typeof import("@/db");
  schema: typeof import("@/db/schema");
  orders: typeof import("@/domain/orders");
  shifts: typeof import("@/domain/shifts");
  registry: typeof import("@/domain/registry");
  stock: typeof import("@/domain/stock");
  q: typeof import("@/domain/queries");
  rec: typeof import("@/domain/receivables");
};

type World = Awaited<ReturnType<typeof makeTenant>>;
let A: World, B: World;

async function makeTenant(name: string) {
  const { db } = m.db;
  const { tenants, users, products, customers, stockMovements } = m.schema;
  const [t] = await db.insert(tenants).values({ name }).returning();
  const [owner, driver] = await db
    .insert(users)
    .values([
      { tenantId: t.id, name: `Dono ${name}`, email: `dono@${t.id}.test`, role: "dono", passwordHash: "x" },
      { tenantId: t.id, name: `Entregador ${name}`, email: `ent@${t.id}.test`, role: "entregador", passwordHash: "x" },
    ])
    .returning();
  const [product] = await db.insert(products).values({ tenantId: t.id, name: `Gás ${name}`, priceCents: 11000 }).returning();
  const [customer] = await db.insert(customers).values({ tenantId: t.id, name: `Cliente ${name}` }).returning();
  await db.insert(stockMovements).values({ tenantId: t.id, productId: product.id, state: "cheio", quantity: 10, reason: "inicial", userId: owner.id });
  const ctx = { tenantId: t.id, userId: owner.id, role: "dono" as const };
  const shift = await m.shifts.openShift(ctx, driver.id, 0);
  const order = await m.orders.createOrder(ctx, {
    mode: "entrega",
    customerId: customer.id,
    items: [{ productId: product.id, quantity: 1, returnsEmpty: true }],
    paymentMethod: "dinheiro",
    deliveryFeeCents: 0,
    changeForCents: null,
    notes: "",
    driverId: null,
  });
  return { t, owner, driver, product, customer, ctx, shift, order };
}

before(async () => {
  await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE ${TEST_DB} ENCODING 'UTF8' TEMPLATE template0`);
  process.env.DATABASE_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${TEST_DB}`);
  m = {
    db: await import("@/db"),
    schema: await import("@/db/schema"),
    orders: await import("@/domain/orders"),
    shifts: await import("@/domain/shifts"),
    registry: await import("@/domain/registry"),
    stock: await import("@/domain/stock"),
    q: await import("@/domain/queries"),
    rec: await import("@/domain/receivables"),
  };
  await m.db.runMigrations();
  A = await makeTenant("A");
  B = await makeTenant("B");
});

after(async () => {
  await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.end();
  process.exit(0); // o pool do app continua aberto; o banco já foi apagado
});

test("consultas de B não enxergam nada de A", async () => {
  assert.equal(await m.q.getOrder(B.t.id, A.order.id), null);
  assert.equal(await m.q.getCustomer(B.t.id, A.customer.id), null);
  assert.equal(await m.q.getShift(B.t.id, A.shift.id), null);
  const orders = await m.q.listOrders(B.t.id);
  assert.ok(orders.every((o) => o.id !== A.order.id));
  const stock = await m.q.stockOverview(B.t.id);
  assert.deepEqual(stock.map((p) => p.id), [B.product.id]);
  const team = await m.q.listUsers(B.t.id);
  assert.ok(team.every((u) => u.id !== A.owner.id && u.id !== A.driver.id));
});

test("B não altera pedidos, turnos ou cadastros de A", async () => {
  const notFound = /não encontrad|indisponível/i;
  await assert.rejects(m.orders.dispatchOrder(B.ctx, A.order.id, B.driver.id), notFound);
  await assert.rejects(m.orders.cancelOrder(B.ctx, A.order.id, "teste"), notFound);
  await assert.rejects(m.orders.deliverOrder(B.ctx, A.order.id), notFound);
  await assert.rejects(m.shifts.closeShift(B.ctx, A.shift.id, 0, ""), notFound);
  await assert.rejects(m.shifts.openShift(B.ctx, A.driver.id, 0), notFound);
  await assert.rejects(
    m.registry.saveCustomer(B.ctx, { name: "invasor", phone: "", address: "", reference: "", notes: "" }, A.customer.id),
    notFound,
  );
  await assert.rejects(
    m.registry.saveProduct(B.ctx, { name: "invasor", priceCents: 1, returnable: true, minStock: 0, active: true }, A.product.id),
    notFound,
  );
  await assert.rejects(m.registry.setUserActive(B.ctx, A.owner.id, false), notFound);
  await assert.rejects(m.stock.adjustStock(B.ctx, { productId: A.product.id, state: "cheio", counted: 0, reason: "teste" }), notFound);
});

test("B não usa produto nem cliente de A num pedido novo", async () => {
  const base = { mode: "entrega" as const, paymentMethod: "dinheiro" as const, deliveryFeeCents: 0, changeForCents: null, notes: "", driverId: null };
  await assert.rejects(
    m.orders.createOrder(B.ctx, { ...base, customerId: B.customer.id, items: [{ productId: A.product.id, quantity: 1, returnsEmpty: true }] }),
    /indisponível/,
  );
  await assert.rejects(
    m.orders.createOrder(B.ctx, { ...base, customerId: A.customer.id, items: [{ productId: B.product.id, quantity: 1, returnsEmpty: true }] }),
    /Cliente não encontrado/,
  );
});

test("A continua intacto depois das tentativas de B", async () => {
  const o = await m.q.getOrder(A.t.id, A.order.id);
  assert.equal(o?.status, "aberto");
  const [owner] = await m.q.listUsers(A.t.id);
  assert.ok(owner.active);
  const [p] = await m.q.stockOverview(A.t.id);
  assert.equal(p.fullStore, 10);
});

test("fiado: saldo, pagamento parcial, teto e isolamento", async () => {
  // venda fiado no balcão já nasce entregue, então vira dívida na hora
  await m.orders.createOrder(A.ctx, {
    mode: "balcao",
    customerId: A.customer.id,
    items: [{ productId: A.product.id, quantity: 1, returnsEmpty: true }],
    paymentMethod: "fiado",
    deliveryFeeCents: 0,
    changeForCents: null,
    notes: "",
    driverId: null,
  });
  assert.equal(await m.rec.customerBalance(A.t.id, A.customer.id), 11000);

  const pay = (ctx: typeof A.ctx, customerId: string, amountCents: number) =>
    m.rec.receivePayment(ctx, { customerId, amountCents, method: "pix", note: "" });

  await assert.rejects(pay(A.ctx, A.customer.id, 11001), /passa do saldo/);
  await pay(A.ctx, A.customer.id, 5000);
  assert.equal(await m.rec.customerBalance(A.t.id, A.customer.id), 6000);

  await assert.rejects(pay(B.ctx, A.customer.id, 100), /Cliente não encontrado/);
  assert.equal((await m.rec.listDebtors(B.t.id)).length, 0);
  const debtorsA = await m.rec.listDebtors(A.t.id);
  assert.deepEqual(debtorsA.map((d) => [d.id, d.owed]), [[A.customer.id, 6000]]);

  await pay(A.ctx, A.customer.id, 6000);
  assert.equal((await m.rec.listDebtors(A.t.id)).length, 0);
  await assert.rejects(pay(A.ctx, A.customer.id, 100), /não tem fiado em aberto/);

  const st = await m.rec.customerStatement(A.t.id, A.customer.id);
  assert.equal(st.owed, 0);
  assert.deepEqual(st.entries.map((e) => e.kind).sort(), ["compra", "pagamento", "pagamento"]);
});
