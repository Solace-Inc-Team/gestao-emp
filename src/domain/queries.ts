import "server-only";
import { and, asc, desc, eq, gte, lt, inArray, isNull, sql, ilike, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, scoped } from "@/db";
import { branches, cashEntries, customerAddresses, customers, orderItems, orders, products, shifts, stockMovements, suppliers, tenants, users, auditLog } from "@/db/schema";
import { expectedCash, paymentSummary } from "@/lib/cash";
import { todayISO } from "@/lib/period";
import { isUuid } from "@/lib/ctx";

// Filial: as consultas da operação (estoque, pedidos, turnos, painel, relatórios) recebem a filial;
// null quer dizer todas (só o dono, nos relatórios). Cliente, fiado e comodato são da empresa inteira.

// meia-noite de Brasília, não a do servidor (o container roda em UTC)
export const startOfToday = () => new Date(`${todayISO()}T00:00:00-03:00`);

export const listProducts = scoped((tenantId: string, onlyActive: boolean = false) =>
  db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), onlyActive ? eq(products.active, true) : undefined))
    .orderBy(asc(products.name)));

export const listSuppliers = scoped((tenantId: string, onlyActive: boolean = false) =>
  db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.tenantId, tenantId), onlyActive ? eq(suppliers.active, true) : undefined))
    .orderBy(asc(suppliers.name)));

export const listDrivers = scoped((tenantId: string, branchId: string | null) =>
  db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), branchId ? eq(users.branchId, branchId) : undefined, eq(users.role, "entregador"), eq(users.active, true)))
    .orderBy(asc(users.name)));

export const listUsers = scoped((tenantId: string) =>
  db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active, branchId: users.branchId, branchName: branches.name })
    .from(users)
    .leftJoin(branches, eq(branches.id, users.branchId))
    .where(eq(users.tenantId, tenantId))
    .orderBy(asc(users.role), asc(users.name)));

export const listCustomers = scoped(function listCustomers(tenantId: string, q: string = "") {
  const term = `%${q.trim()}%`;
  // telefone digitado só com números acha "(11) 98811-2034"
  const digits = q.replace(/\D/g, "");
  return db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        isNull(customers.anonymizedAt),
        q.trim()
          ? or(
              ilike(customers.name, term),
              ilike(customers.phone, term),
              ilike(customers.address, term),
              digits.length >= 4 ? sql`regexp_replace(${customers.phone}, '\\D', '', 'g') like ${`%${digits}%`}` : undefined,
            )
          : undefined,
      ),
    )
    .orderBy(asc(customers.name))
    .limit(200);
});

export const getCustomer = scoped(async function getCustomer(tenantId: string, id: string) {
  const [c] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)));
  return c ?? null;
});

const driver = alias(users, "driver");

const orderCols = {
  id: orders.id,
  trackingId: orders.trackingId,
  number: orders.number,
  status: orders.status,
  paymentMethod: orders.paymentMethod,
  cashPartCents: orders.cashPartCents,
  totalCents: orders.totalCents,
  createdAt: orders.createdAt,
  deliveredAt: orders.deliveredAt,
  dispatchedAt: orders.dispatchedAt,
  origin: orders.origin,
  occurrence: orders.occurrence,
  customerName: customers.name,
  // endereço escolhido no pedido, ou o principal do cliente
  customerAddress: sql<string | null>`coalesce(${orders.address}, ${customers.address})`,
  driverName: driver.name,
  driverId: orders.driverId,
  branchId: orders.branchId,
};

export const listOrders = scoped(function listOrders(
  tenantId: string,
  f: {
    status?: (typeof orders.status.enumValues)[number];
    since?: Date;
    until?: Date;
    deliveredIn?: [Date, Date];
    driverId?: string;
    customerId?: string;
    branchId?: string | null;
    q?: string;
  } = {},
) {
  return db
    .select(orderCols)
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(driver, eq(driver.id, orders.driverId))
    .where(
      and(
        eq(orders.tenantId, tenantId),
        f.branchId ? eq(orders.branchId, f.branchId) : undefined,
        f.status ? eq(orders.status, f.status) : undefined,
        f.since ? gte(orders.createdAt, f.since) : undefined,
        f.until ? lt(orders.createdAt, f.until) : undefined,
        f.deliveredIn ? and(gte(orders.deliveredAt, f.deliveredIn[0]), lt(orders.deliveredAt, f.deliveredIn[1])) : undefined,
        f.driverId ? eq(orders.driverId, f.driverId) : undefined,
        f.customerId ? eq(orders.customerId, f.customerId) : undefined,
        f.q?.trim()
          ? /^#?\d+$/.test(f.q.trim())
            ? eq(orders.number, Number(f.q.trim().replace("#", "")))
            : ilike(customers.name, `%${f.q.trim()}%`)
          : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(300);
});

export const countOrdersByStatus = scoped(async function countOrdersByStatus(tenantId: string, branchId: string | null) {
  const rows = await db
    .select({ status: orders.status, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), branchId ? eq(orders.branchId, branchId) : undefined))
    .groupBy(orders.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<(typeof orders.status.enumValues)[number], number>>;
  return { ...by, total: rows.reduce((s, r) => s + r.n, 0) };
});

export const getOrder = scoped(async function getOrder(tenantId: string, id: string) {
  const [o] = await db
    .select({
      ...orderCols,
      customerId: orders.customerId,
      customerPhone: customers.phone,
      customerReference: sql<string | null>`case when ${orders.address} is null then ${customers.reference} else ${orders.reference} end`,
      deliveryFeeCents: orders.deliveryFeeCents,
      discountCents: orders.discountCents,
      discountReason: orders.discountReason,
      occurrenceAt: orders.occurrenceAt,
      pixConfirmedAt: orders.pixConfirmedAt,
      pixConfirmedBy: orders.pixConfirmedBy,
      changeForCents: orders.changeForCents,
      notes: orders.notes,
      cancelReason: orders.cancelReason,
      refundReason: orders.refundReason,
      shiftId: orders.shiftId,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(driver, eq(driver.id, orders.driverId))
    .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)));
  if (!o) return null;
  const items = await db
    .select({
      id: orderItems.id,
      name: products.name,
      quantity: orderItems.quantity,
      deliveredQuantity: orderItems.deliveredQuantity,
      unitPriceCents: orderItems.unitPriceCents,
      returnsEmpty: orderItems.returnsEmpty,
      loan: orderItems.loan,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, id)));
  const history = await db
    .select({ action: auditLog.action, data: auditLog.data, createdAt: auditLog.createdAt, userName: users.name })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(and(eq(auditLog.tenantId, tenantId), eq(auditLog.entity, "order"), eq(auditLog.entityId, id)))
    .orderBy(asc(auditLog.createdAt));
  return { ...o, items, history };
});

export const listAddresses = scoped(function listAddresses(tenantId: string, customerIds: string[]) {
  if (!customerIds.length) return Promise.resolve([]);
  return db
    .select({ id: customerAddresses.id, customerId: customerAddresses.customerId, label: customerAddresses.label, address: customerAddresses.address, reference: customerAddresses.reference })
    .from(customerAddresses)
    .where(and(eq(customerAddresses.tenantId, tenantId), inArray(customerAddresses.customerId, customerIds)))
    .orderBy(asc(customerAddresses.createdAt));
});

export const getSettings = scoped(async function getSettings(tenantId: string) {
  const [t] = await db
    .select({
      staffDiscountPct: tenants.staffDiscountPct,
      lateAfterMinutes: tenants.lateAfterMinutes,
      pixKey: tenants.pixKey,
      pixName: tenants.pixName,
      pixCity: tenants.pixCity,
      slug: tenants.slug,
      portalEnabled: tenants.portalEnabled,
      // só a conta, nunca o token
      mpConta: tenants.mpConta,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  return t;
});

export const itemsForOrders = scoped(async function itemsForOrders(tenantId: string, orderIds: string[]) {
  if (!orderIds.length) return [];
  return db
    .select({ id: orderItems.id, orderId: orderItems.orderId, name: products.name, quantity: orderItems.quantity, unitPriceCents: orderItems.unitPriceCents, returnsEmpty: orderItems.returnsEmpty, loan: orderItems.loan })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orderItems.tenantId, tenantId), inArray(orderItems.orderId, orderIds)));
});

export const stockOverview = scoped(async function stockOverview(tenantId: string, branchId: string) {
  const prods = await listProducts(tenantId);
  const rows = await db
    .select({
      productId: stockMovements.productId,
      state: stockMovements.state,
      driverId: stockMovements.driverId,
      qty: sql<number>`sum(${stockMovements.quantity})::int`,
    })
    .from(stockMovements)
    .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.branchId, branchId)))
    .groupBy(stockMovements.productId, stockMovements.state, stockMovements.driverId);
  // pedidos lançados que ainda não saíram já "seguram" os cheios da loja
  const held = await db
    .select({ productId: orderItems.productId, qty: sql<number>`sum(${orderItems.quantity})::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.tenantId, tenantId), eq(orders.branchId, branchId), eq(orders.status, "aberto")))
    .groupBy(orderItems.productId);
  return prods.map((p) => {
    const mine = rows.filter((r) => r.productId === p.id);
    const sum = (state: "cheio" | "vazio" | "avariado", atStore: boolean) =>
      mine.filter((r) => r.state === state && (r.driverId === null) === atStore).reduce((s, r) => s + r.qty, 0);
    const fullStore = sum("cheio", true);
    const reserved = held.find((h) => h.productId === p.id)?.qty ?? 0;
    return {
      ...p,
      fullStore,
      reserved,
      available: fullStore - reserved,
      damaged: sum("avariado", true),
      emptyStore: sum("vazio", true),
      fullTransit: sum("cheio", false),
      emptyTransit: sum("vazio", false),
      low: p.active && p.minStock > 0 && fullStore <= p.minStock,
    };
  });
});

export const recentMovements = scoped((tenantId: string, branchId: string, limit: number = 40) =>
  db
    .select({
      id: stockMovements.id,
      productName: products.name,
      state: stockMovements.state,
      quantity: stockMovements.quantity,
      reason: stockMovements.reason,
      driverName: driver.name,
      userName: users.name,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .innerJoin(users, eq(users.id, stockMovements.userId))
    .leftJoin(driver, eq(driver.id, stockMovements.driverId))
    .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.branchId, branchId)))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit));

export const getShift = scoped(async function getShift(tenantId: string, id: string) {
  const [s] = await db
    .select({ shift: shifts, driverName: driver.name })
    .from(shifts)
    .innerJoin(driver, eq(driver.id, shifts.driverId))
    .where(and(eq(shifts.tenantId, tenantId), eq(shifts.id, id)));
  if (!s) return null;
  const shiftOrders = await listShiftOrders(tenantId, id);
  const held = await db
    .select({ name: products.name, state: stockMovements.state, qty: sql<number>`sum(${stockMovements.quantity})::int` })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.driverId, s.shift.driverId)))
    .groupBy(products.name, stockMovements.state);
  const entries = await db
    .select({
      id: cashEntries.id,
      kind: cashEntries.kind,
      amountCents: cashEntries.amountCents,
      note: cashEntries.note,
      createdAt: cashEntries.createdAt,
      by: users.name,
      voidedAt: cashEntries.voidedAt,
      voidReason: cashEntries.voidReason,
    })
    .from(cashEntries)
    .innerJoin(users, eq(users.id, cashEntries.createdBy))
    .where(eq(cashEntries.shiftId, id))
    .orderBy(asc(cashEntries.createdAt));
  const valid = entries.filter((e) => !e.voidedAt);
  const sumOf = (kind: "repasse" | "saida") => valid.filter((e) => e.kind === kind).reduce((t, e) => t + e.amountCents, 0);
  const names = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, [s.shift.closedBy, s.shift.resolvedBy, s.shift.openedBy].filter((x): x is string => !!x)));
  const nameOf = (uid: string | null) => names.find((n) => n.id === uid)?.name ?? null;
  return {
    ...s.shift,
    driverName: s.driverName,
    openedByName: nameOf(s.shift.openedBy),
    closedByName: nameOf(s.shift.closedBy),
    resolvedByName: nameOf(s.shift.resolvedBy),
    orders: shiftOrders,
    entries,
    handedOver: sumOf("repasse"),
    spent: sumOf("saida"),
    expected: s.shift.expectedCashCents ?? expectedCash(s.shift.openingCashCents, shiftOrders, sumOf("repasse") + sumOf("saida")),
    summary: paymentSummary(shiftOrders),
    held: held.filter((h) => h.qty !== 0),
  };
});

const listShiftOrders = (tenantId: string, shiftId: string) =>
  db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      cashPartCents: orders.cashPartCents,
      totalCents: orders.totalCents,
      customerName: customers.name,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(and(eq(orders.tenantId, tenantId), eq(orders.shiftId, shiftId)))
    .orderBy(asc(orders.number));

export const listShifts = scoped(async function listShifts(tenantId: string, branchId: string | null, status?: "aberto" | "fechado") {
  const rows = await db
    .select({ shift: shifts, driverName: driver.name })
    .from(shifts)
    .innerJoin(driver, eq(driver.id, shifts.driverId))
    .where(and(eq(shifts.tenantId, tenantId), branchId ? eq(shifts.branchId, branchId) : undefined, status ? eq(shifts.status, status) : undefined))
    .orderBy(desc(shifts.openedAt))
    .limit(100);
  const openIds = rows.filter((r) => r.shift.status === "aberto").map((r) => r.shift.id);
  const handed = openIds.length
    ? await db
        .select({ shiftId: cashEntries.shiftId, total: sql<number>`sum(${cashEntries.amountCents})::int` })
        .from(cashEntries)
        .where(and(inArray(cashEntries.shiftId, openIds), isNull(cashEntries.voidedAt)))
        .groupBy(cashEntries.shiftId)
    : [];
  return Promise.all(
    rows.map(async (r) => {
      // turno fechado já guardou o esperado; buscar os pedidos dele seria uma consulta por linha à toa
      const os = r.shift.status === "aberto" ? await listShiftOrders(tenantId, r.shift.id) : [];
      const out = handed.find((h) => h.shiftId === r.shift.id)?.total ?? 0;
      return {
        ...r.shift,
        driverName: r.driverName,
        orderCount: os.length,
        inRoute: os.filter((o) => o.status === "em_rota").length,
        expected: r.shift.expectedCashCents ?? expectedCash(r.shift.openingCashCents, os, out),
        pending: r.shift.status === "fechado" && !!r.shift.differenceCents && !r.shift.resolvedAt,
      };
    }),
  );
});

export const openShiftFor = scoped(async function openShiftFor(tenantId: string, driverId: string) {
  const [s] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.tenantId, tenantId), eq(shifts.driverId, driverId), eq(shifts.status, "aberto")));
  return s ?? null;
});

/**
 * Números do painel. `day` (AAAA-MM-DD) e `driverId` filtram as vendas, os pedidos e o que saiu; fila,
 * alertas e dinheiro na rua são sempre do momento (com o entregador, só o turno dele).
 */
export const dashboard = scoped(async function dashboard(tenantId: string, f: { day?: string; driverId?: string; branchId: string }) {
  const since = f.day ? new Date(`${f.day}T00:00:00-03:00`) : startOfToday();
  const until = new Date(since.getTime() + 864e5);
  const today = await listOrders(tenantId, { since, until, driverId: f.driverId, branchId: f.branchId });
  // vendido = entregue no dia, como nos relatórios (pedido de ontem entregue hoje conta hoje)
  const delivered = await listOrders(tenantId, { status: "entregue", deliveredIn: [since, until], driverId: f.driverId, branchId: f.branchId });
  const byMethod = paymentSummary(delivered);
  const open = (await listShifts(tenantId, f.branchId, "aberto")).filter((s) => !f.driverId || s.driverId === f.driverId);
  const [{ divergent }] = await db
    .select({ divergent: sql<number>`count(*)::int` })
    .from(shifts)
    .where(and(eq(shifts.tenantId, tenantId), eq(shifts.branchId, f.branchId), eq(shifts.status, "fechado"), sql`${shifts.differenceCents} <> 0`, isNull(shifts.resolvedAt)));
  const stock = await stockOverview(tenantId, f.branchId);
  const now = await exceptionsNow(tenantId, f.branchId);
  const sold = await db
    .select({ name: products.name, qty: sql<number>`sum(coalesce(${orderItems.deliveredQuantity}, ${orderItems.quantity}))::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.branchId, f.branchId),
        eq(orders.status, "entregue"),
        gte(orders.deliveredAt, since),
        lt(orders.deliveredAt, until),
        f.driverId ? eq(orders.driverId, f.driverId) : undefined,
      ),
    )
    .groupBy(products.name)
    .orderBy(desc(sql`sum(coalesce(${orderItems.deliveredQuantity}, ${orderItems.quantity}))`));
  // os 7 dias até o escolhido, para o número do dia ter com o que comparar
  const weekStart = new Date(since.getTime() - 6 * 864e5);
  const perDay = await db
    .select({
      day: sql<string>`to_char(${orders.deliveredAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
      cents: sql<number>`sum(${orders.totalCents})::int`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.branchId, f.branchId),
        eq(orders.status, "entregue"),
        gte(orders.deliveredAt, weekStart),
        lt(orders.deliveredAt, until),
        f.driverId ? eq(orders.driverId, f.driverId) : undefined,
      ),
    )
    .groupBy(sql`1`);
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart.getTime() + i * 864e5 + 12 * 36e5).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    return { day, cents: perDay.find((d) => d.day === day)?.cents ?? 0 };
  });
  // dia em andamento compara com ontem até a mesma hora; dia fechado, com o dia anterior inteiro
  const agora = Date.now();
  const emAndamento = agora < until.getTime();
  const prevUntil = new Date((emAndamento ? agora : until.getTime()) - 864e5);
  const [{ previous }] = await db
    .select({ previous: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.branchId, f.branchId),
        eq(orders.status, "entregue"),
        gte(orders.deliveredAt, new Date(since.getTime() - 864e5)),
        lt(orders.deliveredAt, prevUntil),
        f.driverId ? eq(orders.driverId, f.driverId) : undefined,
      ),
    );
  return {
    week,
    previous,
    emAndamento,
    revenue: delivered.reduce((s, o) => s + o.totalCents, 0),
    deliveredCount: delivered.length,
    // a fila conta também o que sobrou de ontem
    pending: now.waiting,
    inRoute: now.inRoute,
    late: now.late,
    returned: now.returned,
    pixToCheck: now.pixToCheck,
    byMethod,
    cashInStreet: open.reduce((s, x) => s + x.expected, 0),
    openShifts: open,
    pendingDifferences: divergent,
    lowStock: stock.filter((p) => p.low),
    sold,
    recent: today.slice(0, 8),
  };
});

/** Vendas entregues no período, quebradas por entregador e por produto, mais o que saiu do normal. */
export const periodBreakdown = scoped(async function periodBreakdown(tenantId: string, from: Date, to: Date, branchId: string | null) {
  const daFilial = branchId ? eq(orders.branchId, branchId) : undefined;
  const delivered = and(eq(orders.tenantId, tenantId), daFilial, eq(orders.status, "entregue"), gte(orders.deliveredAt, from), lt(orders.deliveredAt, to));
  const byDriver = await db
    .select({
      name: sql<string>`coalesce(${driver.name}, 'Balcão')`,
      count: sql<number>`count(*)::int`,
      total: sql<number>`sum(${orders.totalCents})::int`,
      cash: sql<number>`sum(case when ${orders.paymentMethod} = 'dinheiro' then ${orders.totalCents} else ${orders.cashPartCents} end)::int`,
      pix: sql<number>`sum(case when ${orders.paymentMethod} = 'pix' then ${orders.totalCents} - ${orders.cashPartCents} else 0 end)::int`,
      card: sql<number>`sum(case when ${orders.paymentMethod} = 'cartao' then ${orders.totalCents} - ${orders.cashPartCents} else 0 end)::int`,
      credit: sql<number>`sum(case when ${orders.paymentMethod} = 'fiado' then ${orders.totalCents} else 0 end)::int`,
      units: sql<number>`(select coalesce(sum(coalesce(i.delivered_quantity, i.quantity)), 0) from order_items i where i.order_id = any(array_agg(${orders.id})))::int`,
    })
    .from(orders)
    .leftJoin(driver, eq(driver.id, orders.driverId))
    .where(delivered)
    .groupBy(sql`1`)
    .orderBy(desc(sql`sum(${orders.totalCents})`));
  const qty = sql`coalesce(${orderItems.deliveredQuantity}, ${orderItems.quantity})`;
  const byProduct = await db
    .select({
      name: products.name,
      qty: sql<number>`sum(${qty})::int`,
      total: sql<number>`sum(${qty} * ${orderItems.unitPriceCents})::int`,
      noReturn: sql<number>`sum(case when ${orderItems.returnsEmpty} then 0 else ${qty} end)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(delivered)
    .groupBy(products.name)
    .orderBy(desc(sql`sum(${qty} * ${orderItems.unitPriceCents})`));
  const [extra] = await db
    .select({
      discounts: sql<number>`coalesce(sum(${orders.discountCents}) filter (where ${orders.status} = 'entregue' and ${orders.deliveredAt} >= ${from.toISOString()} and ${orders.deliveredAt} < ${to.toISOString()}), 0)::int`,
      fees: sql<number>`coalesce(sum(${orders.deliveryFeeCents}) filter (where ${orders.status} = 'entregue' and ${orders.deliveredAt} >= ${from.toISOString()} and ${orders.deliveredAt} < ${to.toISOString()}), 0)::int`,
      cancelled: sql<number>`(count(*) filter (where ${orders.status} = 'cancelado' and ${orders.createdAt} >= ${from.toISOString()} and ${orders.createdAt} < ${to.toISOString()}))::int`,
      refunded: sql<number>`(count(*) filter (where ${orders.status} = 'estornado' and ${orders.refundedAt} >= ${from.toISOString()} and ${orders.refundedAt} < ${to.toISOString()}))::int`,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), daFilial));
  const [events] = await db
    .select({
      occurrences: sql<number>`(count(*) filter (where ${auditLog.action} = 'pedido.ocorrencia'))::int`,
      partials: sql<number>`(count(*) filter (where ${auditLog.action} = 'pedido.entrega_parcial'))::int`,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantId, tenantId),
        eq(auditLog.entity, "order"),
        gte(auditLog.createdAt, from),
        lt(auditLog.createdAt, to),
        branchId ? sql`${auditLog.entityId} in (select id::text from ${orders} where ${orders.branchId} = ${branchId})` : undefined,
      ),
    );
  return { byDriver, byProduct, ...extra, ...events };
});

/** O que pede atenção agora: usado no painel. */
export const exceptionsNow = scoped(async function exceptionsNow(tenantId: string, branchId: string | null) {
  const [t] = await db.select({ lateAfterMinutes: tenants.lateAfterMinutes }).from(tenants).where(eq(tenants.id, tenantId));
  const limit = new Date(Date.now() - t.lateAfterMinutes * 60000);
  const [r] = await db
    .select({
      late: sql<number>`(count(*) filter (where ${orders.status} in ('aberto', 'em_rota') and ${orders.createdAt} < ${limit.toISOString()}))::int`,
      returned: sql<number>`(count(*) filter (where ${orders.status} = 'aberto' and ${orders.occurrence} is not null))::int`,
      pixToCheck: sql<number>`(count(*) filter (where ${orders.status} = 'entregue' and ${orders.paymentMethod} = 'pix' and ${orders.pixConfirmedAt} is null))::int`,
      waiting: sql<number>`(count(*) filter (where ${orders.status} = 'aberto'))::int`,
      inRoute: sql<number>`(count(*) filter (where ${orders.status} = 'em_rota'))::int`,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), branchId ? eq(orders.branchId, branchId) : undefined));
  return r;
});

export const periodReport = scoped(async function periodReport(tenantId: string, from: Date, to: Date, branchId: string | null) {
  const days = await db
    .select({
      day: sql<string>`to_char(${orders.deliveredAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
      total: sql<number>`sum(${orders.totalCents})::int`,
      // pagamento misto: a parte em dinheiro conta como dinheiro, o resto na forma escolhida
      cash: sql<number>`sum(case when ${orders.paymentMethod} = 'dinheiro' then ${orders.totalCents} else ${orders.cashPartCents} end)::int`,
      pix: sql<number>`sum(case when ${orders.paymentMethod} = 'pix' then ${orders.totalCents} - ${orders.cashPartCents} else 0 end)::int`,
      card: sql<number>`sum(case when ${orders.paymentMethod} = 'cartao' then ${orders.totalCents} - ${orders.cashPartCents} else 0 end)::int`,
      credit: sql<number>`sum(case when ${orders.paymentMethod} = 'fiado' then ${orders.totalCents} else 0 end)::int`,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), branchId ? eq(orders.branchId, branchId) : undefined, eq(orders.status, "entregue"), gte(orders.deliveredAt, from), lt(orders.deliveredAt, to)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const closed = await db
    .select({ shift: shifts, driverName: driver.name })
    .from(shifts)
    .innerJoin(driver, eq(driver.id, shifts.driverId))
    .where(and(eq(shifts.tenantId, tenantId), branchId ? eq(shifts.branchId, branchId) : undefined, eq(shifts.status, "fechado"), gte(shifts.closedAt, from), lt(shifts.closedAt, to)))
    .orderBy(desc(shifts.closedAt));
  return { days, closed };
});

/**
 * Registros da auditoria no período, do mais novo para o mais antigo, com filtro por pessoa e por área
 * (o começo do nome da ação: "pedido", "turno", "estoque"...). Traz também os nomes que o texto precisa
 * (número do pedido, entregador do turno, produto, cliente) para a tela não mostrar ids.
 */
export const listAudit = scoped(async function listAudit(
  tenantId: string,
  f: { from: Date; to: Date; userId?: string; area?: string; page?: number },
) {
  const porPagina = 50;
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      data: auditLog.data,
      createdAt: auditLog.createdAt,
      userName: users.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(
      and(
        eq(auditLog.tenantId, tenantId),
        gte(auditLog.createdAt, f.from),
        lt(auditLog.createdAt, f.to),
        f.userId ? eq(auditLog.userId, f.userId) : undefined,
        f.area ? ilike(auditLog.action, `${f.area}.%`) : undefined,
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(porPagina + 1)
    .offset((f.page ?? 0) * porPagina);
  const page = rows.slice(0, porPagina);

  // nomes por tipo de registro, numa consulta por tipo
  const ids = (entity: string) => [...new Set(page.filter((r) => r.entity === entity && r.entityId && isUuid(r.entityId)).map((r) => r.entityId!))];
  const pessoas = [
    ...new Set(
      page.flatMap((r) => {
        const d = (r.data ?? {}) as Record<string, unknown>;
        // "from"/"to" também aparecem com estado de vasilhame ("vazio"): só entra o que tem forma de id
        return [d.driverId, d.from, d.to].filter((x): x is string => typeof x === "string" && isUuid(x));
      }),
    ),
  ];
  const [ped, tur, prod, cli, usu, forn] = await Promise.all([
    ids("order").length ? db.select({ id: orders.id, n: orders.number }).from(orders).where(and(eq(orders.tenantId, tenantId), inArray(orders.id, ids("order")))) : [],
    ids("shift").length
      ? db.select({ id: shifts.id, n: driver.name }).from(shifts).innerJoin(driver, eq(driver.id, shifts.driverId)).where(and(eq(shifts.tenantId, tenantId), inArray(shifts.id, ids("shift"))))
      : [],
    ids("product").length ? db.select({ id: products.id, n: products.name }).from(products).where(and(eq(products.tenantId, tenantId), inArray(products.id, ids("product")))) : [],
    ids("customer").length ? db.select({ id: customers.id, n: customers.name }).from(customers).where(and(eq(customers.tenantId, tenantId), inArray(customers.id, ids("customer")))) : [],
    [...ids("user"), ...pessoas].length
      ? db.select({ id: users.id, n: users.name }).from(users).where(and(eq(users.tenantId, tenantId), inArray(users.id, [...ids("user"), ...pessoas])))
      : [],
    ids("supplier").length ? db.select({ id: suppliers.id, n: suppliers.name }).from(suppliers).where(and(eq(suppliers.tenantId, tenantId), inArray(suppliers.id, ids("supplier")))) : [],
  ]);
  const nomes: Record<string, string> = {};
  for (const x of ped) nomes[x.id] = `#${x.n}`;
  for (const x of [...tur, ...prod, ...cli, ...usu, ...forn]) nomes[x.id] = x.n;
  return { rows: page, nomes, more: rows.length > porPagina };
});

/**
 * Primeiros passos de uma empresa nova, deduzidos dos próprios dados: cada passo
 * fica feito quando a coisa existe de verdade, sem marcar nada à mão.
 */
export const primeirosPassos = scoped(async function primeirosPassos(tenantId: string) {
  const [r] = await db
    .select({
      produtos: sql<boolean>`exists (select 1 from ${products} where ${products.tenantId} = ${tenantId})`,
      estoque: sql<boolean>`exists (select 1 from ${stockMovements} where ${stockMovements.tenantId} = ${tenantId})`,
      equipe: sql<boolean>`exists (select 1 from ${users} where ${users.tenantId} = ${tenantId} and ${users.role} = 'entregador' and ${users.active})`,
      pix: sql<boolean>`(select ${tenants.pixKey} <> '' or ${tenants.mpTokenEnc} is not null from ${tenants} where ${tenants.id} = ${tenantId})`,
      turno: sql<boolean>`exists (select 1 from ${shifts} where ${shifts.tenantId} = ${tenantId})`,
      pedido: sql<boolean>`exists (select 1 from ${orders} where ${orders.tenantId} = ${tenantId})`,
    })
    .from(sql`(select 1) as um`);
  return r;
});
