import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  date,
  uuid,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const id = () => uuid("id").primaryKey().defaultRandom();
const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["dono", "atendente", "caixa", "entregador"]);
export const orderStatusEnum = pgEnum("order_status", [
  "aberto",
  "em_rota",
  "entregue",
  "cancelado",
  "estornado",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["dinheiro", "pix", "cartao", "fiado"]);
export const shiftStatusEnum = pgEnum("shift_status", ["aberto", "fechado"]);
export const expenseMethodEnum = pgEnum("expense_method", ["dinheiro", "pix", "cartao", "boleto"]);
export const cashEntryKindEnum = pgEnum("cash_entry_kind", ["repasse", "saida"]);
export const containerStateEnum = pgEnum("container_state", ["cheio", "vazio", "avariado"]);

export const tenants = pgTable("tenants", {
  id: id(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  // conta o prazo da política: dados de empresa cancelada saem em até 90 dias
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  // regras da casa, ajustadas pelo dono em Configurações
  staffDiscountPct: integer("staff_discount_pct").notNull().default(10),
  lateAfterMinutes: integer("late_after_minutes").notNull().default(60),
  // recebimento por Pix na chave da própria empresa
  pixKey: text("pix_key").notNull().default(""),
  pixName: text("pix_name").notNull().default(""),
  pixCity: text("pix_city").notNull().default(""),
  // portal de pedidos: endereço público /pedir/<slug>
  slug: text("slug").notNull().unique(),
  portalEnabled: boolean("portal_enabled").notNull().default(false),
  createdAt: createdAt(),
});

// prova de que a exclusão foi feita; fica fora da empresa apagada, por isso sem chave estrangeira
export const tenantDeletions = pgTable("tenant_deletions", {
  id: id(),
  tenantId: uuid("tenant_id").notNull(),
  tenantName: text("tenant_name").notNull(),
  deletedBy: text("deleted_by").notNull(),
  counts: jsonb("counts").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
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
    // segredo TOTP (base32); só vale depois que o usuário confirma um código
    totpSecret: text("totp_secret"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    // versão dos termos que o dono aceitou e quando (aceite eletrônico)
    termsVersion: text("terms_version"),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
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
  // senha conferida, falta o código de 2FA: a sessão ainda não dá acesso
  mfaPending: boolean("mfa_pending").notNull().default(false),
});

// falhas de login e de código 2FA, para bloquear tentativa em massa
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

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
    // cobrado a mais quando o cliente não devolve um vazio e fica com o vasilhame
    containerPriceCents: integer("container_price_cents").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("products_tenant_idx").on(t.tenantId), uniqueIndex("products_tenant_name_uq").on(t.tenantId, sql`lower(${t.name})`)],
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
    // LGPD: dados pessoais apagados a pedido do cliente; os pedidos continuam nos relatórios
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
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
    // diferença no acerto fica pendente até o dono dizer o que foi feito dela
    resolution: text("resolution"),
    resolutionNotes: text("resolution_notes"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("shifts_tenant_status_idx").on(t.tenantId, t.status)],
);

// dinheiro que sai da mão do entregador antes do acerto: repasse ao caixa ou gasto autorizado na rua.
// Nunca é editado nem apagado; o erro se corrige com estorno.
export const cashEntries = pgTable(
  "cash_entries",
  {
    id: id(),
    tenantId: tenantId(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id),
    kind: cashEntryKindEnum("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    note: text("note").notNull().default(""),
    // saída autorizada também entra nas despesas da empresa
    expenseId: uuid("expense_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidReason: text("void_reason"),
  },
  (t) => [index("cash_entries_shift_idx").on(t.shiftId)],
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
    // pagamento misto: parte em dinheiro de um pedido pago no Pix ou no cartão (passa pela mão do entregador)
    cashPartCents: integer("cash_part_cents").notNull().default(0),
    origin: text("origin").notNull().default("telefone"),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    discountReason: text("discount_reason"),
    totalCents: integer("total_cents").notNull(),
    // endereço de entrega quando não é o principal do cliente
    address: text("address"),
    reference: text("reference"),
    // última tentativa de entrega que não deu certo
    occurrence: text("occurrence"),
    occurrenceAt: timestamp("occurrence_at", { withTimezone: true }),
    // Pix só conta como recebido depois que alguém confere no extrato do banco
    pixConfirmedAt: timestamp("pix_confirmed_at", { withTimezone: true }),
    pixConfirmedBy: uuid("pix_confirmed_by").references(() => users.id),
    changeForCents: integer("change_for_cents"),
    notes: text("notes").notNull().default(""),
    cancelReason: text("cancel_reason"),
    refundReason: text("refund_reason"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
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
  // entrega parcial: quanto chegou de fato ao cliente (vazio = tudo)
  deliveredQuantity: integer("delivered_quantity"),
  unitPriceCents: integer("unit_price_cents").notNull(),
  // false = cliente levou o vasilhame junto
  returnsEmpty: boolean("returns_empty").notNull().default(true),
});

// baixa de fiado: o saldo do cliente é fiado entregue menos estes pagamentos
export const customerPayments = pgTable(
  "customer_payments",
  {
    id: id(),
    tenantId: tenantId(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethodEnum("method").notNull(),
    note: text("note").notNull().default(""),
    receivedBy: uuid("received_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    // lançado por engano: fica no histórico, mas não abate a dívida
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidReason: text("void_reason"),
  },
  (t) => [index("customer_payments_tenant_customer_idx").on(t.tenantId, t.customerId)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    tenantId: tenantId(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: expenseMethodEnum("method").notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    // preenchido quando a despesa é a devolução de um pedido estornado
    orderId: uuid("order_id").references(() => orders.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidReason: text("void_reason"),
  },
  (t) => [index("expenses_tenant_paid_idx").on(t.tenantId, t.paidOn)],
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: id(),
    tenantId: tenantId(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    label: text("label").notNull(),
    address: text("address").notNull(),
    reference: text("reference").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("customer_addresses_customer_idx").on(t.customerId)],
);

// erros do servidor, agrupados por assinatura; é da plataforma (Solace), não de uma empresa
export const errorEvents = pgTable("error_events", {
  id: id(),
  fingerprint: text("fingerprint").notNull().unique(),
  message: text("message").notNull(),
  stack: text("stack").notNull().default(""),
  path: text("path").notNull().default(""),
  method: text("method").notNull().default(""),
  kind: text("kind").notNull().default(""),
  count: integer("count").notNull().default(1),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  lastAlertAt: timestamp("last_alert_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
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
    supplierId: uuid("supplier_id"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("stock_tenant_product_idx").on(t.tenantId, t.productId)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    notes: text("notes").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("suppliers_tenant_idx").on(t.tenantId)],
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
