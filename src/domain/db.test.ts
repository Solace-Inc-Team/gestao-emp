// Testes com banco de verdade: isolamento entre empresas e as regras que dependem de SQL.
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
  exp: typeof import("@/domain/expenses");
  platform: typeof import("@/domain/platform");
  exportTenant: typeof import("@/domain/export");
  monitoring: typeof import("@/domain/monitoring");
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
    exp: await import("@/domain/expenses"),
    platform: await import("@/domain/platform"),
    exportTenant: await import("@/domain/export"),
    monitoring: await import("@/domain/monitoring"),
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

test("estorno: turno aberto bloqueia, estoque volta e a devolução vira despesa", async () => {
  const sale = await m.orders.createOrder(A.ctx, {
    mode: "entrega",
    customerId: A.customer.id,
    items: [{ productId: A.product.id, quantity: 1, returnsEmpty: true }],
    paymentMethod: "dinheiro",
    deliveryFeeCents: 0,
    changeForCents: null,
    notes: "",
    driverId: A.driver.id,
  });
  await m.orders.deliverOrder(A.ctx, sale.id);
  const refund = { orderId: sale.id, reason: "cliente devolveu", restock: true };
  await assert.rejects(m.orders.refundOrder(A.ctx, refund), /turno deste pedido ainda está aberto/);

  await m.shifts.closeShift(A.ctx, A.shift.id, 11000, "");
  const before = (await m.q.stockOverview(A.t.id))[0];
  await assert.rejects(m.orders.refundOrder(B.ctx, refund), /não encontrado/);
  await m.orders.refundOrder(A.ctx, refund);
  const after = (await m.q.stockOverview(A.t.id))[0];
  assert.equal(after.fullStore, before.fullStore + 1);
  assert.equal(after.emptyStore, before.emptyStore - 1);
  assert.equal((await m.q.getOrder(A.t.id, sale.id))?.status, "estornado");
  await assert.rejects(m.orders.refundOrder(A.ctx, refund), /Só pedidos entregues/);

  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const list = await m.exp.listExpenses(A.t.id, today, today);
  const auto = list.find((e) => e.orderId === sale.id);
  assert.equal(auto?.category, "estorno");
  assert.equal(auto?.amountCents, 11000);
  await assert.rejects(m.exp.voidExpense(A.ctx, auto!.id, "engano"), /não pode ser cancelada/);
  // no resultado, a devolução não desconta de novo o que já saiu das vendas
  assert.equal(
    (await m.exp.expensesTotal(A.t.id, today, today)) - (await m.exp.expensesTotal(A.t.id, today, today, true)),
    11000,
  );
  assert.equal((await m.exp.listExpenses(B.t.id, today, today)).length, 0);
});

test("estorno de fiado exige estornar os pagamentos antes", async () => {
  const st = await m.rec.customerStatement(A.t.id, A.customer.id);
  const fiadoOrder = st.entries.find((e) => e.kind === "compra")!;
  const payments = st.entries.filter((e) => e.kind === "pagamento");
  const refund = { orderId: fiadoOrder.id, reason: "lançado errado", restock: false };

  await assert.rejects(m.orders.refundOrder(A.ctx, refund), /já pagou parte/);
  await assert.rejects(m.rec.voidPayment(B.ctx, payments[0].id, "teste"), /não encontrado/);
  for (const p of payments) await m.rec.voidPayment(A.ctx, p.id, "lançado em dobro");
  await assert.rejects(m.rec.voidPayment(A.ctx, payments[0].id, "de novo"), /já estornado/);
  assert.equal(await m.rec.customerBalance(A.t.id, A.customer.id), 11000);

  await m.orders.refundOrder(A.ctx, refund);
  assert.equal(await m.rec.customerBalance(A.t.id, A.customer.id), 0);
});

test("despesas: lançar, cancelar e totalizar só o que vale", async () => {
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const base = await m.exp.expensesTotal(A.t.id, today, today);
  const e = await m.exp.createExpense(A.ctx, { category: "combustivel", description: "Diesel", amountCents: 20000, method: "pix", paidOn: today });
  assert.equal(await m.exp.expensesTotal(A.t.id, today, today), base + 20000);
  await assert.rejects(m.exp.voidExpense(B.ctx, e.id, "teste"), /não encontrada/);
  await m.exp.voidExpense(A.ctx, e.id, "lançado em dobro");
  assert.equal(await m.exp.expensesTotal(A.t.id, today, today), base);
  await assert.rejects(m.exp.voidExpense({ ...A.ctx, role: "atendente" }, e.id, "x"), /Sem permissão/);
});

test("redefinir senha: só dentro da empresa, derruba sessões e desliga 2FA do dono", async () => {
  const { db } = m.db;
  const { users, sessions } = m.schema;
  const { eq } = await import("drizzle-orm");
  await assert.rejects(m.registry.resetUserPassword(B.ctx, A.driver.id, "senha-nova-1"), /não encontrado/);
  await assert.rejects(m.registry.resetUserPassword(A.ctx, A.owner.id, "senha-nova-1"), /própria senha/);

  await db.insert(sessions).values({ id: "sessao-teste", userId: A.driver.id, expiresAt: new Date(Date.now() + 3600e3) });
  await m.registry.resetUserPassword(A.ctx, A.driver.id, "senha-nova-1");
  assert.equal((await db.select().from(sessions).where(eq(sessions.userId, A.driver.id))).length, 0);

  await db.update(users).set({ totpEnabled: true, totpSecret: "ABC" }).where(eq(users.id, A.owner.id));
  const admin = { ...B.ctx, platformAdmin: true, name: "", email: "", tenantName: "", totpEnabled: false, termsVersion: null };
  await assert.rejects(m.platform.resetOwnerAccess({ ...admin, platformAdmin: false }, A.t.id, "senha-nova-2"), /Sem permissão/);
  assert.equal(await m.platform.resetOwnerAccess(admin, A.t.id, "senha-nova-2"), A.owner.email);
  const [o] = await db.select().from(users).where(eq(users.id, A.owner.id));
  assert.equal(o.totpEnabled, false);
  assert.equal(o.totpSecret, null);
});

test("exportação leva só os dados da empresa e nada sensível", async () => {
  const { unzipSync, strFromU8 } = await import("fflate");
  const { db } = m.db;
  const { users } = m.schema;
  const { eq } = await import("drizzle-orm");
  await db.update(users).set({ totpSecret: "SEGREDOTOTPTESTE" }).where(eq(users.id, B.owner.id));

  const { zip, counts } = await m.exportTenant.exportTenant({ tenantId: B.t.id, userId: B.owner.id });
  const files = unzipSync(zip);
  assert.ok(files["pedidos.csv"] && files["LEIA-ME.txt"]);
  assert.equal(counts["pedidos.csv"], 1);

  const forbidden = [A.t.id, A.customer.name, A.product.name, A.owner.email, "scrypt$", "SEGREDOTOTPTESTE"];
  for (const [name, bytes] of Object.entries(files)) {
    const text = strFromU8(bytes);
    for (const f of forbidden) assert.ok(!text.includes(f), `${name} contém "${f}"`);
    if (!name.endsWith(".csv")) continue;
    // toda linha com o mesmo número de colunas do cabeçalho (campos aqui não têm ";" nem aspas)
    const [head, ...lines] = text.replace(/^﻿/, "").split("\r\n");
    for (const l of lines) assert.equal(l.split(";").length, head.split(";").length, `${name}: ${l}`);
  }
  assert.ok(strFromU8(files["clientes.csv"]).includes(B.customer.name));
});

test("monitoramento: agrupa o mesmo erro, avisa uma vez por hora e de novo após resolvido", async () => {
  const sent: string[] = [];
  const send = async (t: string) => void sent.push(t);
  const req = { path: "/pedidos/3e0bd8e0-4d24-4469-a223-b2a857d53536?q=Maria", method: "GET", kind: "render" };
  const boom = () => new Error("conexão caiu no pedido 42");
  const t0 = new Date("2026-11-09T12:00:00Z");

  assert.deepEqual(await m.monitoring.recordError(boom(), req, send, t0), { recorded: true, alerted: true });
  assert.deepEqual(await m.monitoring.recordError(boom(), req, send, new Date(t0.getTime() + 60_000)), { recorded: true, alerted: false });
  assert.equal(sent.length, 1);
  assert.ok(sent[0].includes("GET /pedidos/:id") && !sent[0].includes("Maria"), "caminho sem id e sem busca");

  // passou uma hora: avisa de novo
  await m.monitoring.recordError(boom(), req, send, new Date(t0.getTime() + 61 * 60_000));
  assert.equal(sent.length, 2);

  const admin = { ...A.ctx, platformAdmin: true, name: "", email: "", tenantName: "", totpEnabled: false, termsVersion: null };
  const [ev] = await m.monitoring.listErrors(admin);
  assert.equal(ev.count, 3);
  assert.equal(ev.path, "/pedidos/:id");
  await m.monitoring.resolveError(admin, ev.id);
  await m.monitoring.recordError(boom(), req, send, new Date(t0.getTime() + 62 * 60_000));
  assert.equal(sent.length, 3, "erro resolvido que volta avisa na hora");

  const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
  assert.deepEqual(await m.monitoring.recordError(redirect, req, send), { recorded: false, alerted: false });

  // alerta quebrado não derruba nada
  const r = await m.monitoring.recordError(new Error("outro"), req, async () => { throw new Error("telegram fora"); });
  assert.equal(r.recorded, true);
  await assert.rejects(m.monitoring.listErrors({ ...admin, platformAdmin: false }), /Sem permissão/);
});

test("aceite dos termos: só o dono, com versão e data", async () => {
  const { db } = m.db;
  const { users, auditLog } = m.schema;
  const { eq, and } = await import("drizzle-orm");
  await assert.rejects(m.registry.acceptTerms({ ...A.ctx, role: "atendente" }, "2026-11-09"), /Sem permissão/);
  await m.registry.acceptTerms(A.ctx, "2026-11-09");
  const [o] = await db.select().from(users).where(eq(users.id, A.owner.id));
  assert.equal(o.termsVersion, "2026-11-09");
  assert.ok(o.termsAcceptedAt instanceof Date);
  const log = await db.select().from(auditLog).where(and(eq(auditLog.tenantId, A.t.id), eq(auditLog.action, "termos.aceite")));
  assert.equal(log.length, 1);
});
