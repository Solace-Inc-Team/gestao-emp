import "server-only";
import { and, asc, desc, eq, gte, lt, inArray, sql, ilike, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, scoped } from "@/db";
import { customers, orderItems, orders, products, shifts, stockMovements, users, auditLog } from "@/db/schema";
import { expectedCash, paymentSummary } from "@/lib/cash";
import { todayISO } from "@/lib/period";

// meia-noite de Brasília, não a do servidor (o container roda em UTC)
export const startOfToday = () => new Date(`${todayISO()}T00:00:00-03:00`);

export const listProducts = scoped((tenantId: string, onlyActive: boolean = false) =>
  db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), onlyActive ? eq(products.active, true) : undefined))
    .orderBy(asc(products.name)));

export const listDrivers = scoped((tenantId: string) =>
  db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "entregador"), eq(users.active, true)))
    .orderBy(asc(users.name)));

export const listUsers = scoped((tenantId: string) =>
  db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active })
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .orderBy(asc(users.role), asc(users.name)));

export const listCustomers = scoped(function listCustomers(tenantId: string, q: string = "") {
  const term = `%${q.trim()}%`;
  return db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        q.trim() ? or(ilike(customers.name, term), ilike(customers.phone, term), ilike(customers.address, term)) : undefined,
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
  number: orders.number,
  status: orders.status,
  paymentMethod: orders.paymentMethod,
  totalCents: orders.totalCents,
  createdAt: orders.createdAt,
  deliveredAt: orders.deliveredAt,
  customerName: customers.name,
  customerAddress: customers.address,
  driverName: driver.name,
  driverId: orders.driverId,
};

export const listOrders = scoped(function listOrders(
  tenantId: string,
  f: { status?: (typeof orders.status.enumValues)[number]; since?: Date; driverId?: string; customerId?: string; q?: string } = {},
) {
  return db
    .select(orderCols)
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(driver, eq(driver.id, orders.driverId))
    .where(
      and(
        eq(orders.tenantId, tenantId),
        f.status ? eq(orders.status, f.status) : undefined,
        f.since ? gte(orders.createdAt, f.since) : undefined,
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

export const countOrdersByStatus = scoped(async function countOrdersByStatus(tenantId: string) {
  const rows = await db
    .select({ status: orders.status, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
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
      customerReference: customers.reference,
      deliveryFeeCents: orders.deliveryFeeCents,
      changeForCents: orders.changeForCents,
      notes: orders.notes,
      cancelReason: orders.cancelReason,
      refundReason: orders.refundReason,
      dispatchedAt: orders.dispatchedAt,
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
      unitPriceCents: orderItems.unitPriceCents,
      returnsEmpty: orderItems.returnsEmpty,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, id)));
  const history = await db
    .select({ action: auditLog.action, createdAt: auditLog.createdAt, userName: users.name })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(and(eq(auditLog.tenantId, tenantId), eq(auditLog.entity, "order"), eq(auditLog.entityId, id)))
    .orderBy(asc(auditLog.createdAt));
  return { ...o, items, history };
});

export const itemsForOrders = scoped(async function itemsForOrders(tenantId: string, orderIds: string[]) {
  if (!orderIds.length) return [];
  return db
    .select({ orderId: orderItems.orderId, name: products.name, quantity: orderItems.quantity, returnsEmpty: orderItems.returnsEmpty })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orderItems.tenantId, tenantId), inArray(orderItems.orderId, orderIds)));
});

export const stockOverview = scoped(async function stockOverview(tenantId: string) {
  const prods = await listProducts(tenantId);
  const rows = await db
    .select({
      productId: stockMovements.productId,
      state: stockMovements.state,
      driverId: stockMovements.driverId,
      qty: sql<number>`sum(${stockMovements.quantity})::int`,
    })
    .from(stockMovements)
    .where(eq(stockMovements.tenantId, tenantId))
    .groupBy(stockMovements.productId, stockMovements.state, stockMovements.driverId);
  return prods.map((p) => {
    const mine = rows.filter((r) => r.productId === p.id);
    const sum = (state: "cheio" | "vazio", atStore: boolean) =>
      mine.filter((r) => r.state === state && (r.driverId === null) === atStore).reduce((s, r) => s + r.qty, 0);
    const fullStore = sum("cheio", true);
    return {
      ...p,
      fullStore,
      emptyStore: sum("vazio", true),
      fullTransit: sum("cheio", false),
      emptyTransit: sum("vazio", false),
      low: p.active && fullStore <= p.minStock,
    };
  });
});

export const recentMovements = scoped((tenantId: string, limit: number = 40) =>
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
    .where(eq(stockMovements.tenantId, tenantId))
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
  return {
    ...s.shift,
    driverName: s.driverName,
    orders: shiftOrders,
    expected: s.shift.expectedCashCents ?? expectedCash(s.shift.openingCashCents, shiftOrders),
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
      totalCents: orders.totalCents,
      customerName: customers.name,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(and(eq(orders.tenantId, tenantId), eq(orders.shiftId, shiftId)))
    .orderBy(asc(orders.number));

export const listShifts = scoped(async function listShifts(tenantId: string, status?: "aberto" | "fechado") {
  const rows = await db
    .select({ shift: shifts, driverName: driver.name })
    .from(shifts)
    .innerJoin(driver, eq(driver.id, shifts.driverId))
    .where(and(eq(shifts.tenantId, tenantId), status ? eq(shifts.status, status) : undefined))
    .orderBy(desc(shifts.openedAt))
    .limit(100);
  return Promise.all(
    rows.map(async (r) => {
      const os = await listShiftOrders(tenantId, r.shift.id);
      return {
        ...r.shift,
        driverName: r.driverName,
        orderCount: os.length,
        inRoute: os.filter((o) => o.status === "em_rota").length,
        expected: r.shift.expectedCashCents ?? expectedCash(r.shift.openingCashCents, os),
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

export const dashboard = scoped(async function dashboard(tenantId: string) {
  const since = startOfToday();
  const today = await listOrders(tenantId, { since });
  const delivered = today.filter((o) => o.status === "entregue");
  const byMethod = paymentSummary(delivered);
  const open = await listShifts(tenantId, "aberto");
  const [{ divergent }] = await db
    .select({ divergent: sql<number>`count(*)::int` })
    .from(shifts)
    .where(and(eq(shifts.tenantId, tenantId), eq(shifts.status, "fechado"), sql`${shifts.differenceCents} <> 0`, gte(shifts.closedAt, new Date(Date.now() - 7 * 864e5))));
  const stock = await stockOverview(tenantId);
  const sold = await db
    .select({ name: products.name, qty: sql<number>`sum(${orderItems.quantity})::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orders.tenantId, tenantId), eq(orders.status, "entregue"), gte(orders.deliveredAt, since)))
    .groupBy(products.name)
    .orderBy(desc(sql`sum(${orderItems.quantity})`));
  return {
    revenue: delivered.reduce((s, o) => s + o.totalCents, 0),
    deliveredCount: delivered.length,
    pending: today.filter((o) => o.status === "aberto").length,
    inRoute: today.filter((o) => o.status === "em_rota").length,
    byMethod,
    cashInStreet: open.reduce((s, x) => s + x.expected, 0),
    openShifts: open,
    divergentLast7: divergent,
    lowStock: stock.filter((p) => p.low),
    sold,
    recent: today.slice(0, 8),
  };
});

export const periodReport = scoped(async function periodReport(tenantId: string, from: Date, to: Date) {
  const days = await db
    .select({
      day: sql<string>`to_char(${orders.deliveredAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
      total: sql<number>`sum(${orders.totalCents})::int`,
      cash: sql<number>`sum(case when ${orders.paymentMethod} = 'dinheiro' then ${orders.totalCents} else 0 end)::int`,
      pix: sql<number>`sum(case when ${orders.paymentMethod} = 'pix' then ${orders.totalCents} else 0 end)::int`,
      card: sql<number>`sum(case when ${orders.paymentMethod} = 'cartao' then ${orders.totalCents} else 0 end)::int`,
      credit: sql<number>`sum(case when ${orders.paymentMethod} = 'fiado' then ${orders.totalCents} else 0 end)::int`,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.status, "entregue"), gte(orders.deliveredAt, from), lt(orders.deliveredAt, to)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const closed = await db
    .select({ shift: shifts, driverName: driver.name })
    .from(shifts)
    .innerJoin(driver, eq(driver.id, shifts.driverId))
    .where(and(eq(shifts.tenantId, tenantId), eq(shifts.status, "fechado"), gte(shifts.closedAt, from), lt(shifts.closedAt, to)))
    .orderBy(desc(shifts.closedAt));
  return { days, closed };
});
