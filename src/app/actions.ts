"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { requireUser, requireAdmin, createSession, destroySession, getPendingMfa, completeMfa } from "@/lib/auth";
import { isBlocked, recordFailure, clearFailures, BLOCKED_MESSAGE } from "@/lib/rate-limit";
import { newTotpSecret, verifyTotp } from "@/lib/totp";
import { hashPassword, verifyPassword } from "@/lib/password";
import { DomainError } from "@/lib/ctx";
import { parseBRL } from "@/lib/money";
import type { ActionState } from "@/components/action-form";
import { createOrder, dispatchOrder, deliverOrder, cancelOrder, newOrderSchema } from "@/domain/orders";
import { openShift, closeShift } from "@/domain/shifts";
import { receivePurchase, adjustStock } from "@/domain/stock";
import { receivePayment, paymentSchema } from "@/domain/receivables";
import { createTenant, newTenantSchema, setTenantActive } from "@/domain/platform";
import { saveCustomer, customerSchema, saveProduct, productSchema, createUser, userSchema, setUserActive } from "@/domain/registry";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optId = (fd: FormData, k: string) => str(fd, k) || null;
const int = (fd: FormData, k: string) => {
  const n = Number(str(fd, k) || "0");
  if (!Number.isInteger(n)) throw new DomainError("Quantidade inválida.");
  return n;
};
function money(fd: FormData, k: string, required = true): number | null {
  const v = str(fd, k);
  if (!v) {
    if (required) throw new DomainError("Informe o valor.");
    return null;
  }
  const c = parseBRL(v);
  if (c === null || c < 0) throw new DomainError(`Valor inválido: "${v}". Use o formato 12,50.`);
  return c;
}

async function run(fn: () => Promise<unknown>, paths: string[], ok?: string): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Dados inválidos." };
    throw e;
  }
  paths.forEach((p) => revalidatePath(p, "layout"));
  return { ok };
}

export async function login(fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const key = `login:${email}`;
  if (await isBlocked(key)) return { error: BLOCKED_MESSAGE };
  const [u] = await db
    .select({ user: users, tenantActive: tenants.active })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(eq(users.email, email));
  // mesma mensagem nos dois casos pra não entregar quais e-mails existem
  if (!u || !u.user.active || !(await verifyPassword(password, u.user.passwordHash))) {
    await recordFailure(key);
    return { error: "E-mail ou senha incorretos." };
  }
  await clearFailures(key);
  if (!u.tenantActive) return { error: "O acesso desta empresa está suspenso. Fale com a Solace." };
  if (u.user.totpEnabled) {
    await createSession(u.user.id, true);
    redirect("/login/codigo");
  }
  await createSession(u.user.id);
  redirect(homeFor(u.user));
}

const homeFor = (u: { platformAdmin: boolean; role: string }) =>
  u.platformAdmin ? "/admin" : u.role === "entregador" ? "/entregador" : "/";

export async function verifyMfaAction(fd: FormData): Promise<ActionState> {
  const pending = await getPendingMfa();
  if (!pending?.secret) redirect("/login");
  const key = `totp:${pending.userId}`;
  if (await isBlocked(key)) return { error: BLOCKED_MESSAGE };
  if (!verifyTotp(pending.secret, str(fd, "code"))) {
    await recordFailure(key);
    return { error: "Código inválido. Confira o app autenticador e tente de novo." };
  }
  await clearFailures(key);
  await completeMfa(pending.sessionId, pending.userId);
  redirect(homeFor(pending));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function createOrderAction(fd: FormData): Promise<ActionState> {
  const user = await requireUser("dono", "atendente");
  let id = "";
  const r = await run(async () => {
    let customerId = optId(fd, "customerId");
    const newName = str(fd, "newCustomerName");
    if (!customerId && newName) {
      // TODO: criar o cliente dentro da mesma transação do pedido
      const c = await saveCustomer(
        user,
        customerSchema.parse({
          name: newName,
          phone: str(fd, "newCustomerPhone"),
          address: str(fd, "newCustomerAddress"),
          reference: str(fd, "newCustomerReference"),
          notes: "",
        }),
      );
      customerId = c.id;
    }
    const order = await createOrder(
      user,
      newOrderSchema.parse({
        mode: str(fd, "mode"),
        customerId,
        items: JSON.parse(str(fd, "items") || "[]"),
        paymentMethod: str(fd, "paymentMethod"),
        deliveryFeeCents: money(fd, "deliveryFee", false) ?? 0,
        changeForCents: money(fd, "changeFor", false),
        notes: str(fd, "notes"),
        driverId: optId(fd, "driverId"),
      }),
    );
    id = order.id;
  }, ["/"]);
  if (r?.error) return r;
  redirect(`/pedidos/${id}`);
}

export async function dispatchAction(fd: FormData) {
  const user = await requireUser("dono", "atendente");
  const driverId = str(fd, "driverId");
  if (!driverId) return { error: "Escolha o entregador." };
  return run(() => dispatchOrder(user, str(fd, "orderId"), driverId), ["/"], "Pedido saiu para entrega.");
}

export async function deliverAction(fd: FormData) {
  const user = await requireUser();
  return run(() => deliverOrder(user, str(fd, "orderId")), ["/"], "Entrega confirmada.");
}

export async function cancelAction(fd: FormData) {
  const user = await requireUser("dono", "atendente");
  return run(() => cancelOrder(user, str(fd, "orderId"), str(fd, "reason")), ["/"], "Pedido cancelado.");
}

export async function openShiftAction(fd: FormData) {
  const user = await requireUser("dono", "atendente");
  return run(
    async () => openShift(user, str(fd, "driverId"), money(fd, "openingCash", false) ?? 0),
    ["/"],
    "Turno aberto.",
  );
}

export async function closeShiftAction(fd: FormData) {
  const user = await requireUser("dono", "atendente");
  return run(
    async () => closeShift(user, str(fd, "shiftId"), money(fd, "counted")!, str(fd, "notes")),
    ["/"],
    "Acerto registrado.",
  );
}

export async function purchaseAction(fd: FormData) {
  const user = await requireUser("dono", "atendente");
  return run(
    async () =>
      receivePurchase(user, {
        productId: str(fd, "productId"),
        full: int(fd, "full"),
        emptiesReturned: int(fd, "empties"),
        note: str(fd, "note"),
      }),
    ["/"],
    "Entrada registrada.",
  );
}

export async function adjustAction(fd: FormData) {
  const user = await requireUser("dono");
  const state = str(fd, "state") === "vazio" ? "vazio" : "cheio";
  return run(
    async () => adjustStock(user, { productId: str(fd, "productId"), state, counted: int(fd, "counted"), reason: str(fd, "reason") }),
    ["/"],
    "Estoque ajustado.",
  );
}

export async function saveCustomerAction(fd: FormData) {
  const user = await requireUser("dono", "atendente");
  const id = optId(fd, "id") ?? undefined;
  return run(
    async () =>
      saveCustomer(
        user,
        customerSchema.parse({
          name: str(fd, "name"),
          phone: str(fd, "phone"),
          address: str(fd, "address"),
          reference: str(fd, "reference"),
          notes: str(fd, "notes"),
        }),
        id,
      ),
    ["/"],
    id ? "Cliente atualizado." : "Cliente cadastrado.",
  );
}

export async function saveProductAction(fd: FormData) {
  const user = await requireUser("dono");
  const id = optId(fd, "id") ?? undefined;
  return run(
    async () =>
      saveProduct(
        user,
        productSchema.parse({
          name: str(fd, "name"),
          priceCents: money(fd, "price"),
          returnable: fd.get("returnable") === "on",
          minStock: int(fd, "minStock"),
          active: id ? fd.get("active") === "on" : true,
        }),
        id,
      ),
    ["/"],
    id ? "Produto atualizado." : "Produto cadastrado.",
  );
}

export async function createUserAction(fd: FormData) {
  const user = await requireUser("dono");
  return run(
    async () =>
      createUser(
        user,
        userSchema.parse({ name: str(fd, "name"), email: str(fd, "email"), password: str(fd, "password"), role: str(fd, "role") }),
      ),
    ["/"],
    "Usuário criado.",
  );
}

export async function toggleUserAction(fd: FormData) {
  const user = await requireUser("dono");
  return run(() => setUserActive(user, str(fd, "userId"), str(fd, "active") === "true"), ["/"]);
}

export async function createTenantAction(fd: FormData) {
  const admin = await requireAdmin();
  return run(
    async () =>
      createTenant(
        admin,
        newTenantSchema.parse({
          company: str(fd, "company"),
          ownerName: str(fd, "ownerName"),
          email: str(fd, "email"),
          password: str(fd, "password"),
        }),
      ),
    ["/admin"],
    "Empresa criada. Passe o e-mail e a senha inicial para o dono.",
  );
}

export async function toggleTenantAction(fd: FormData) {
  const admin = await requireAdmin();
  return run(() => setTenantActive(admin, str(fd, "tenantId"), str(fd, "active") === "true"), ["/admin"]);
}

export async function changePasswordAction(fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const next = str(fd, "next");
  if (next.length < 8) return { error: "A nova senha precisa de ao menos 8 caracteres." };
  if (next !== str(fd, "confirm")) return { error: "A confirmação não bate com a nova senha." };
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.userId));
  if (!u || !(await verifyPassword(str(fd, "current"), u.hash))) return { error: "Senha atual incorreta." };
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.userId));
  return { ok: "Senha alterada." };
}

export async function startTotpAction(): Promise<ActionState> {
  const user = await requireUser();
  if (user.totpEnabled) return { error: "A verificação em duas etapas já está ativa." };
  await db.update(users).set({ totpSecret: newTotpSecret() }).where(eq(users.id, user.userId));
  revalidatePath("/senha");
}

export async function confirmTotpAction(fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [u] = await db.select({ secret: users.totpSecret }).from(users).where(eq(users.id, user.userId));
  if (!u?.secret) return { error: "Comece a configuração de novo." };
  if (!verifyTotp(u.secret, str(fd, "code"))) return { error: "Código inválido. Confira se o relógio do celular está certo." };
  await db.update(users).set({ totpEnabled: true }).where(eq(users.id, user.userId));
  revalidatePath("/", "layout");
  return { ok: "Verificação em duas etapas ativada." };
}

export async function disableTotpAction(fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.userId));
  if (!u || !(await verifyPassword(str(fd, "password"), u.hash))) return { error: "Senha incorreta." };
  await db.update(users).set({ totpEnabled: false, totpSecret: null }).where(eq(users.id, user.userId));
  revalidatePath("/", "layout");
  return { ok: "Verificação em duas etapas desativada." };
}

export async function receivePaymentAction(fd: FormData) {
  const user = await requireUser("dono", "atendente");
  return run(
    async () =>
      receivePayment(
        user,
        paymentSchema.parse({ customerId: str(fd, "customerId"), amountCents: money(fd, "amount"), method: str(fd, "method"), note: str(fd, "note") }),
      ),
    ["/"],
    "Pagamento registrado.",
  );
}
