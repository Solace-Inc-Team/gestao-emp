import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["dono", "atendente", "entregador"]);
export const orderStatusEnum = pgEnum("order_status", [
  "aberto",
  "em_rota",
  "entregue",
  "cancelado",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["dinheiro", "pix", "cartao", "fiado"]);
export const shiftStatusEnum = pgEnum("shift_status", ["aberto", "fechado"]);
export const containerStateEnum = pgEnum("container_state", ["cheio", "vazio"]);

export const tenants = pgTable("tenants", {
  id: id(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    active: boolean("active").notNull().default(true),
    // equipe da Solace: acessa /admin
    platformAdmin: boolean("platform_admin").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const sessions = pgTable("sessions", {
  // sha256 do token, o token puro só existe no cookie
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const products = pgTable(
  "products",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    // botijão/galão: venda troca cheio por vazio
    returnable: boolean("returnable").notNull().default(true),
    minStock: integer("min_stock").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("products_tenant_idx").on(t.tenantId)],
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    reference: text("reference").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("customers_tenant_idx").on(t.tenantId)],
);

export const shifts = pgTable(
  "shifts",
  {
    id: id(),
    tenantId: tenantId(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => users.id),
    status: shiftStatusEnum("status").notNull().default("aberto"),
    openingCashCents: integer("opening_cash_cents").notNull().default(0),
    expectedCashCents: integer("expected_cash_cents"),
    countedCashCents: integer("counted_cash_cents"),
    differenceCents: integer("difference_cents"),
    closingNotes: text("closing_notes").notNull().default(""),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id),
    closedBy: uuid("closed_by").references(() => users.id),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("shifts_tenant_status_idx").on(t.tenantId, t.status)],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    tenantId: tenantId(),
    number: integer("number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    status: orderStatusEnum("status").notNull().default("aberto"),
    driverId: uuid("driver_id").references(() => users.id),
    shiftId: uuid("shift_id").references(() => shifts.id),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    changeForCents: integer("change_for_cents"),
    notes: text("notes").notNull().default(""),
    cancelReason: text("cancel_reason"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_tenant_status_idx").on(t.tenantId, t.status),
    index("orders_tenant_created_idx").on(t.tenantId, t.createdAt),
    uniqueIndex("orders_tenant_number_uq").on(t.tenantId, t.number),
  ],
);

export const orderItems = pgTable("order_items", {
  id: id(),
  tenantId: tenantId(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  // false = cliente levou o vasilhame junto
  returnsEmpty: boolean("returns_empty").notNull().default(true),
});

// saldo = soma das movimentações; driver_id null = loja
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: id(),
    tenantId: tenantId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    state: containerStateEnum("state").notNull(),
    driverId: uuid("driver_id").references(() => users.id),
    quantity: integer("quantity").notNull(),
    reason: text("reason").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    shiftId: uuid("shift_id").references(() => shifts.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("stock_tenant_product_idx").on(t.tenantId, t.productId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_tenant_created_idx").on(t.tenantId, t.createdAt)],
);
