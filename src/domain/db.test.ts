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
  await db.update(users).set({ totpEnabled: true, totpSecret: "ABC" }).where(eq(users.id, A.driver.id));
  await m.registry.resetUserPassword(A.ctx, A.driver.id, "senha-nova-1");
  assert.equal((await db.select().from(sessions).where(eq(sessions.userId, A.driver.id))).length, 0);
  const [d] = await db.select().from(users).where(eq(users.id, A.driver.id));
  assert.equal(d.totpEnabled, false);

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

test("exclusão de empresa: travas, apaga tudo dela e mais nada", async () => {
  const { db } = m.db;
  const { sessions, loginAttempts, tenantDeletions } = m.schema;
  const { eq } = await import("drizzle-orm");
  const C = await makeTenant("C");
  await db.insert(sessions).values({ id: "sessao-c", userId: C.owner.id, expiresAt: new Date(Date.now() + 3600e3) });
  await db.insert(loginAttempts).values({ key: `login:${C.owner.email}:10.0.0.1` });

  const admin = { ...A.ctx, platformAdmin: true, name: "", email: "admin@teste", tenantName: "", totpEnabled: false, termsVersion: null };
  const countOf = async (table: string, t: string) =>
    Number((await m.db.pgClient.unsafe(`select count(*)::int n from ${table} where tenant_id = $1`, [t]))[0].n);
  const tables = ["audit_log", "customer_payments", "cash_entries", "customer_addresses", "expenses", "stock_movements", "order_items", "orders", "shifts", "customers", "products", "suppliers", "users"];
  const before = { A: await countOf("orders", A.t.id), B: await countOf("orders", B.t.id) };

  await assert.rejects(m.platform.deleteTenant(admin, C.t.id, "C"), /Suspenda a empresa/);
  await m.platform.setTenantActive(admin, C.t.id, false);
  await assert.rejects(m.platform.deleteTenant(admin, C.t.id, "Empresa errada"), /nome exato/);
  await assert.rejects(m.platform.deleteTenant(admin, A.t.id, "A"), /não pode ser excluída/);
  await assert.rejects(m.platform.deleteTenant({ ...admin, platformAdmin: false }, C.t.id, "C"), /Sem permissão/);

  const counts = await m.platform.deleteTenant(admin, C.t.id, " C ");
  assert.equal(counts.pedidos, 1);
  assert.equal(counts.usuarios, 2);
  assert.equal(counts.sessoes, 1);
  assert.equal(counts.tentativas_login, 1);
  for (const t of tables) assert.equal(await countOf(t, C.t.id), 0, `sobrou dado em ${t}`);
  assert.equal((await db.select().from(sessions).where(eq(sessions.userId, C.owner.id))).length, 0);

  const [log] = await db.select().from(tenantDeletions).where(eq(tenantDeletions.tenantId, C.t.id));
  assert.equal(log.tenantName, "C");
  assert.equal(log.deletedBy, "admin@teste");

  assert.equal(await countOf("orders", A.t.id), before.A);
  assert.equal(await countOf("orders", B.t.id), before.B);
});

test("cliente novo e pedido na mesma transação: pedido recusado não deixa cliente", async () => {
  const customers = async () => (await m.q.listCustomers(A.t.id)).length;
  const before = await customers();
  await assert.rejects(
    m.db.tenantTransaction(A.ctx, async () => {
      const c = await m.registry.saveCustomer(A.ctx, { name: "Cliente de passagem", phone: "", address: "", reference: "", notes: "" });
      await m.orders.createOrder(A.ctx, {
        mode: "entrega",
        customerId: c.id,
        items: [{ productId: A.product.id, quantity: 1, returnsEmpty: true }],
        paymentMethod: "dinheiro",
        deliveryFeeCents: 0,
        changeForCents: 1, // menor que o total
        notes: "",
        driverId: null,
      });
    }),
    /troco é menor/,
  );
  assert.equal(await customers(), before);
});

test("produto com nome repetido na empresa é recusado, em outra empresa não", async () => {
  const p = { priceCents: 100, returnable: false, minStock: 0, active: true };
  await assert.rejects(m.registry.saveProduct(A.ctx, { ...p, name: "gás a" }), /Já existe um produto/);
  const outro = await m.registry.saveProduct(A.ctx, { ...p, name: "Produto Único A" });
  await m.registry.saveProduct(A.ctx, { ...p, name: "Produto Único A" }, outro.id); // salvar ele mesmo pode
  await m.registry.saveProduct(B.ctx, { ...p, name: "Produto Único A" });
});

test("anonimizar cliente: exige fiado quitado, apaga dados e some da busca", async () => {
  const { db } = m.db;
  const { auditLog } = m.schema;
  const { and, eq } = await import("drizzle-orm");
  const c = await m.registry.saveCustomer(A.ctx, { name: "Maria Sigilo", phone: "11999990000", address: "Rua X", reference: "", notes: "" });
  await m.registry.saveCustomer(A.ctx, { name: "Maria Sigilo", phone: "11999990000", address: "Rua Y", reference: "", notes: "" }, c.id);
  const fiado = await m.orders.createOrder(A.ctx, {
    mode: "balcao", customerId: c.id, items: [{ productId: A.product.id, quantity: 1, returnsEmpty: true }],
    paymentMethod: "fiado", deliveryFeeCents: 0, changeForCents: null, notes: "", driverId: null,
  });
  await assert.rejects(m.registry.anonymizeCustomer(A.ctx, c.id), /fiado em aberto/);
  await m.rec.receivePayment(A.ctx, { customerId: c.id, amountCents: fiado.totalCents, method: "pix", note: "" });
  await assert.rejects(m.registry.anonymizeCustomer(B.ctx, c.id), /não encontrado/);
  await assert.rejects(m.registry.anonymizeCustomer({ ...A.ctx, role: "atendente" }, c.id), /Sem permissão/);

  await m.registry.anonymizeCustomer(A.ctx, c.id);
  const [after] = await m.q.listCustomers(A.t.id, "Sigilo");
  assert.equal(after, undefined);
  const logs = await db.select().from(auditLog).where(and(eq(auditLog.entity, "customer"), eq(auditLog.entityId, c.id)));
  assert.ok(!JSON.stringify(logs).includes("Rua"));
  await assert.rejects(m.registry.anonymizeCustomer(A.ctx, c.id), /já foram apagados/);
});

test("caixa: repasse e gasto diminuem o esperado; diferença fica pendente até o dono resolver", async () => {
  const { db } = m.db;
  const { users } = m.schema;
  const [driver] = await db.insert(users).values({ tenantId: A.t.id, name: "Entregador Caixa", email: `cx@${A.t.id}.test`, role: "entregador", passwordHash: "x" }).returning();
  const caixa = { ...A.ctx, role: "caixa" as const };
  const atendente = { ...A.ctx, role: "atendente" as const };
  const shift = await m.shifts.openShift(atendente, driver.id, 5000);
  const order = await m.orders.createOrder(A.ctx, {
    mode: "entrega", customerId: A.customer.id, items: [{ productId: A.product.id, quantity: 2, returnsEmpty: true }],
    paymentMethod: "dinheiro", deliveryFeeCents: 0, changeForCents: null, notes: "", driverId: driver.id,
  });
  await m.orders.deliverOrder({ tenantId: A.t.id, userId: driver.id, role: "entregador" }, order.id);
  // em mãos: 50 de troco + 220 da entrega
  const entry = (kind: "repasse" | "saida", amountCents: number) => ({ shiftId: shift.id, kind, amountCents, note: "gasolina", category: "combustivel" });
  await assert.rejects(m.shifts.addCashEntry(atendente, entry("repasse", 1000)), /Sem permissão/);
  await assert.rejects(m.shifts.addCashEntry(B.ctx, entry("repasse", 1000)), /não encontrado/);
  await assert.rejects(m.shifts.addCashEntry(caixa, entry("repasse", 27001)), /tem R\$\s270,00/);
  await m.shifts.addCashEntry(caixa, entry("repasse", 10000));
  const wrong = await m.shifts.addCashEntry(caixa, entry("saida", 9000));
  await assert.rejects(m.exp.voidExpense(A.ctx, wrong.expenseId!, "erro"), /tela do acerto/);
  await assert.rejects(m.shifts.voidCashEntry(caixa, wrong.id, "valor errado"), /Sem permissão/);
  await m.shifts.voidCashEntry(A.ctx, wrong.id, "valor errado");
  await assert.rejects(m.shifts.voidCashEntry(A.ctx, wrong.id, "de novo"), /já estornado/);
  await m.shifts.addCashEntry(caixa, entry("saida", 3000));

  const view = await m.q.getShift(A.t.id, shift.id);
  assert.equal(view!.expected, 5000 + 22000 - 10000 - 3000);
  const today = new Date().toISOString().slice(0, 10);
  const spent = (await m.exp.listExpenses(A.t.id, "2000-01-01", "2999-01-01")).filter((e) => e.description === "gasolina" && !e.voidedAt);
  assert.equal(spent.length, 1);
  assert.ok(today);

  await assert.rejects(m.shifts.closeShift(atendente, shift.id, 14000, ""), /Sem permissão/);
  const closed = await m.shifts.closeShift(caixa, shift.id, 13000, "faltou dez");
  assert.equal(closed.differenceCents, -1000);
  await assert.rejects(m.shifts.addCashEntry(caixa, entry("repasse", 100)), /já foi fechado/);
  await assert.rejects(m.shifts.resolveDifference(caixa, shift.id, "descontado", "combinado"), /Sem permissão/);
  await assert.rejects(m.shifts.resolveDifference(A.ctx, shift.id, "inventado", "combinado"), /Escolha/);
  await m.shifts.resolveDifference(A.ctx, shift.id, "descontado", "desconto no vale de sexta");
  await assert.rejects(m.shifts.resolveDifference(A.ctx, shift.id, "descontado", "de novo"), /não tem diferença pendente/);
});

test("pedido: desconto com limite, pagamento misto, entrega parcial, ocorrência e troca de entregador", async () => {
  const { db } = m.db;
  const { users, orders, stockMovements } = m.schema;
  const { and, eq, sql } = await import("drizzle-orm");
  const mk = (n: string) => ({ tenantId: A.t.id, name: n, email: `${n}@${A.t.id}.test`, role: "entregador" as const, passwordHash: "x" });
  const [d1, d2] = await db.insert(users).values([mk("rota1"), mk("rota2")]).returning();
  await m.stock.receivePurchase(A.ctx, { productId: A.product.id, full: 20, emptiesReturned: 0, note: "carga do teste" });
  const s1 = await m.shifts.openShift(A.ctx, d1.id, 0);
  await m.shifts.openShift(A.ctx, d2.id, 0);
  const atendente = { ...A.ctx, role: "atendente" as const };
  const held = async (driverId: string) =>
    (await db.select({ q: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)::int` }).from(stockMovements)
      .where(and(eq(stockMovements.driverId, driverId), eq(stockMovements.state, "cheio"))))[0].q;
  const base = {
    mode: "entrega" as const, customerId: A.customer.id, items: [{ productId: A.product.id, quantity: 3, returnsEmpty: true }],
    deliveryFeeCents: 0, changeForCents: null, notes: "", driverId: d1.id,
  };

  // 3 x 110 = 330; limite da equipe é 10% (33,00)
  await assert.rejects(m.orders.createOrder(atendente, { ...base, paymentMethod: "pix", discountCents: 3301, discountReason: "amigo" }), /acima do seu limite/);
  await assert.rejects(m.orders.createOrder(A.ctx, { ...base, paymentMethod: "pix", discountCents: 1000 }), /motivo do desconto/);
  await assert.rejects(m.orders.createOrder(A.ctx, { ...base, paymentMethod: "fiado", cashPartCents: 1000 }), /Pix ou no cartão/);
  await assert.rejects(m.orders.createOrder(A.ctx, { ...base, paymentMethod: "pix", cashPartCents: 33000 }), /menor que o total/);
  const o = await m.orders.createOrder(atendente, { ...base, paymentMethod: "pix", discountCents: 3000, discountReason: "cliente antigo", cashPartCents: 10000, origin: "whatsapp" });
  assert.equal(o.totalCents, 30000);
  assert.equal(await held(d1.id), 3);

  // troca de entregador leva a carga junto
  await assert.rejects(m.orders.reassignOrder(B.ctx, o.id, d2.id), /não encontrado/);
  await m.orders.reassignOrder(atendente, o.id, d2.id);
  assert.equal(await held(d1.id), 0);
  assert.equal(await held(d2.id), 3);

  // não conseguiu entregar: volta para a fila e a carga volta para a loja
  const driver2 = { tenantId: A.t.id, userId: d2.id, role: "entregador" as const };
  await assert.rejects(m.orders.reportOccurrence({ ...driver2, userId: d1.id }, o.id, "ausente", ""), /outro entregador/);
  await m.orders.reportOccurrence(driver2, o.id, "ausente", "ninguém atendeu");
  assert.equal(await held(d2.id), 0);
  const [back] = await db.select().from(orders).where(eq(orders.id, o.id));
  assert.equal(back.status, "aberto");
  assert.match(back.occurrence!, /Cliente ausente: ninguém atendeu/);

  // sai de novo e chega só 1 de 3: total refeito, 2 cheios continuam com o entregador
  await m.orders.dispatchOrder(atendente, o.id, d1.id);
  const driver1 = { tenantId: A.t.id, userId: d1.id, role: "entregador" as const };
  const [item] = (await m.q.getOrder(A.t.id, o.id))!.items;
  await assert.rejects(m.orders.deliverOrder(driver1, o.id, { delivered: { [item.id]: 0 }, note: "nada" }), /Não consegui entregar/);
  await assert.rejects(m.orders.deliverOrder(driver1, o.id, { delivered: { [item.id]: 4 }, note: "a mais" }), /inválida/);
  await m.orders.deliverOrder(driver1, o.id, { delivered: { [item.id]: 1 }, note: "só quis um" });
  const after = (await m.q.getOrder(A.t.id, o.id))!;
  assert.equal(after.totalCents, 11000 - 3000);
  assert.equal(after.cashPartCents, 8000);
  assert.equal(after.items[0].deliveredQuantity, 1);
  assert.equal(await held(d1.id), 2);
  // no acerto, só a parte em dinheiro é cobrada do entregador
  assert.equal((await m.q.getShift(A.t.id, s1.id))!.expected, 8000);
});

test("cliente: endereço extra vai para o pedido e some na anonimização", async () => {
  const { db } = m.db;
  const { customerAddresses } = m.schema;
  const { eq } = await import("drizzle-orm");
  const c = await m.registry.saveCustomer(A.ctx, { name: "Cliente Dois Endereços", phone: "", address: "Rua Principal, 1", reference: "", notes: "" });
  await m.registry.addAddress(A.ctx, { customerId: c.id, label: "Trabalho", address: "Av. do Trabalho, 500", reference: "portaria" });
  await assert.rejects(m.registry.addAddress(B.ctx, { customerId: c.id, label: "Invasor", address: "Rua de B, 9", reference: "" }), /não encontrado/);
  const [addr] = await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, c.id));
  const order = await m.orders.createOrder(A.ctx, {
    mode: "entrega", customerId: c.id, addressId: addr.id, items: [{ productId: A.product.id, quantity: 1, returnsEmpty: true }],
    paymentMethod: "pix", deliveryFeeCents: 0, changeForCents: null, notes: "", driverId: null,
  });
  assert.equal((await m.q.getOrder(A.t.id, order.id))!.customerAddress, "Av. do Trabalho, 500");
  await m.orders.cancelOrder(A.ctx, order.id, "teste");
  await m.registry.anonymizeCustomer(A.ctx, c.id);
  assert.equal((await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, c.id))).length, 0);
  assert.equal((await m.q.getOrder(A.t.id, order.id))!.customerAddress, "");
});

test("estoque: avaria, inventário, compra com fornecedor, reserva e preço do vasilhame", async () => {
  const p = await m.registry.saveProduct(A.ctx, { name: "Galão Estoque", priceCents: 1500, containerPriceCents: 4000, returnable: true, minStock: 0, active: true });
  const s = await m.stock.saveSupplier(A.ctx, { name: "Fonte Serra", phone: "", notes: "", active: true });
  const sB = await m.stock.saveSupplier(B.ctx, { name: "Fornecedor de B", phone: "", notes: "", active: true });
  await assert.rejects(m.stock.receivePurchase(A.ctx, { productId: p.id, full: 10, emptiesReturned: 0, note: "", supplierId: sB.id }), /Fornecedor não encontrado/);
  await m.stock.receivePurchase(A.ctx, { productId: p.id, full: 10, emptiesReturned: 0, note: "NF 12", supplierId: s.id, costCents: 9000, costMethod: "pix" });
  const bought = (await m.exp.listExpenses(A.t.id, "2000-01-01", "2999-01-01")).find((e) => e.description.includes("Galão Estoque"));
  assert.equal(bought?.amountCents, 9000);
  assert.match(bought!.description, /Fonte Serra/);

  await m.stock.markDamaged({ ...A.ctx, role: "atendente" }, { productId: p.id, from: "cheio", quantity: 2, note: "trincado" });
  await assert.rejects(m.stock.markDamaged(A.ctx, { productId: p.id, from: "vazio", quantity: 1, note: "amassado" }), /Estoque insuficiente/);
  const row = async () => (await m.q.stockOverview(A.t.id)).find((x) => x.id === p.id)!;
  assert.deepEqual([(await row()).fullStore, (await row()).damaged], [8, 2]);

  // pedido aguardando segura o estoque; sem vazio para trocar, o vasilhame entra no preço
  const o = await m.orders.createOrder(A.ctx, {
    mode: "entrega", customerId: A.customer.id, items: [{ productId: p.id, quantity: 3, returnsEmpty: false }],
    paymentMethod: "pix", deliveryFeeCents: 0, changeForCents: null, notes: "", driverId: null,
  });
  assert.equal(o.totalCents, 3 * (1500 + 4000));
  assert.deepEqual([(await row()).reserved, (await row()).available], [3, 5]);
  await m.orders.cancelOrder(A.ctx, o.id, "teste de reserva");
  assert.equal((await row()).reserved, 0);

  await assert.rejects(m.stock.runInventory({ ...A.ctx, role: "caixa" }, [{ productId: p.id, state: "cheio", counted: 8 }], ""), /Sem permissão/);
  await assert.rejects(m.stock.runInventory(B.ctx, [{ productId: p.id, state: "cheio", counted: 1 }], ""), /não encontrado/);
  const diffs = await m.stock.runInventory(A.ctx, [
    { productId: p.id, state: "cheio", counted: 7 },
    { productId: p.id, state: "vazio", counted: 0 },
    { productId: p.id, state: "avariado", counted: 2 },
  ], "contagem de teste");
  assert.deepEqual(diffs, [{ product: "Galão Estoque", state: "cheio", before: 8, counted: 7 }]);
  assert.equal((await row()).fullStore, 7);
});

test("RLS: dentro do escopo de A, consulta sem filtro só enxerga A", async () => {
  const { db, withTenant } = m.db;
  const { orders, customers, users, tenants } = m.schema;
  const { eq, sql } = await import("drizzle-orm");

  await withTenant(A.t.id, async () => {
    const [{ role }] = await db.execute<{ role: string }>(sql`select current_user as role`);
    assert.equal(role, "app_tenant");

    // nenhum "where tenant_id": quem filtra é o Postgres
    const allOrders = await db.select({ t: orders.tenantId }).from(orders);
    assert.ok(allOrders.length > 0 && allOrders.every((o) => o.t === A.t.id));
    const allTenants = await db.select({ id: tenants.id }).from(tenants);
    assert.deepEqual(allTenants.map((t) => t.id), [A.t.id]);

    // alterar linha de B não acha nada; inserir com tenant de B é recusado
    const changed = await db.update(customers).set({ name: "invasor" }).where(eq(customers.id, B.customer.id)).returning();
    assert.equal(changed.length, 0);
    const gone = await db.delete(users).where(eq(users.id, B.owner.id)).returning();
    assert.equal(gone.length, 0);
    await assert.rejects(
      db.transaction((tx) => tx.insert(customers).values({ tenantId: B.t.id, name: "plantado em B" })),
      (e: Error & { cause?: Error }) => /row-level security/.test(e.cause?.message ?? e.message),
    );
  });

  await assert.rejects(withTenant(A.t.id, () => withTenant(B.t.id, async () => 1)), /outra empresa/);
  const [b] = await db.select().from(customers).where(eq(customers.id, B.customer.id));
  assert.equal(b.name, B.customer.name);
});

test("RLS: e-mail usado em outra empresa vira mensagem, não erro 500", async () => {
  await assert.rejects(
    m.registry.createUser(A.ctx, { name: "Copia", email: B.owner.email, password: "senha-qualquer-1", role: "atendente" }),
    /Já existe um usuário com este e-mail/,
  );
});

test("caixa: despacho espera o acerto e não entra em turno fechado", async () => {
  // turno aberto do entregador de B (criado na montagem), com um pedido aguardando
  const o = await m.orders.createOrder(B.ctx, {
    mode: "entrega",
    customerId: B.customer.id,
    items: [{ productId: B.product.id, quantity: 1, returnsEmpty: true }],
    paymentMethod: "pix",
    deliveryFeeCents: 0,
    changeForCents: null,
    notes: "",
    driverId: null,
  });
  // fechar e despachar ao mesmo tempo: o despacho precisa ver o turno já fechado
  const [closed, dispatched] = await Promise.allSettled([
    m.shifts.closeShift(B.ctx, B.shift.id, 0, ""),
    m.orders.dispatchOrder(B.ctx, o.id, B.driver.id),
  ]);
  const order = await m.q.getOrder(B.t.id, o.id);
  if (closed.status === "fulfilled") {
    assert.equal(dispatched.status, "rejected");
    assert.equal(order?.status, "aberto");
  } else {
    // o despacho ganhou: o acerto recusou por ter pedido em rota, que é o comportamento certo
    assert.equal(order?.status, "em_rota");
  }
  await assert.rejects(m.shifts.openShift(B.ctx, B.driver.id, 0).then(() => m.shifts.openShift(B.ctx, B.driver.id, 0)), /já tem um turno aberto/);
});
