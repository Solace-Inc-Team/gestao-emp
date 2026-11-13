import { and, eq, isNull } from "drizzle-orm";
import { db, tenantTransaction, withTenant } from "@/db";
import { auditLog, orders, tenants } from "@/db/schema";
import { type Ctx, DomainError, assertRole, isUuid } from "@/lib/ctx";
import { cifrar, decifrar } from "@/lib/segredo";
import { ErroMp, cancelarPixMp, contaMp, criarPixMp, pagamentoMp } from "@/lib/mercadopago";
import { pixPayload } from "@/lib/pix";
import { audit } from "./stock";

// Pix do pedido. Com a conta do Mercado Pago ligada, cada pedido no Pix vira uma cobrança própria, com o
// valor certo, e o pedido fica pago sozinho quando o Mercado Pago confirma. Sem ela (ou se o Mercado Pago
// falhar), vale o Pix na chave da empresa, conferido à mão no extrato, como sempre foi.

const PRAZO_MS = 24 * 60 * 60 * 1000;

/** Código Pix na chave da empresa (sem confirmação automática). */
export function orderPix(t: { pixKey: string; pixName: string; pixCity: string }, order: { number: number; totalCents: number }) {
  if (!t.pixKey) return null;
  return pixPayload({ key: t.pixKey, name: t.pixName, city: t.pixCity, amountCents: order.totalCents, txid: `PED${order.number}` });
}

export async function conectarMercadoPago(ctx: Ctx, token: string) {
  assertRole(ctx, "dono");
  const t = token.trim();
  if (!/^(APP_USR|TEST)-[\w-]{20,}$/.test(t)) throw new DomainError("Cole o Access Token inteiro (começa com APP_USR- ou TEST-).");
  let conta: { nome: string };
  try {
    conta = await contaMp(t);
  } catch (e) {
    if (e instanceof ErroMp) throw new DomainError(e.tokenInvalido ? "O Mercado Pago não aceitou este token. Confira se copiou o Access Token certo." : `${e.message} Tente de novo em instantes.`);
    throw e;
  }
  await tenantTransaction(ctx, async (tx) => {
    await tx.update(tenants).set({ mpTokenEnc: cifrar(t), mpConta: conta.nome }).where(eq(tenants.id, ctx.tenantId));
    await audit(tx, ctx, "empresa.mp_conectar", "tenant", ctx.tenantId, { conta: conta.nome, teste: t.startsWith("TEST-") || undefined });
  });
  return conta;
}

export async function desconectarMercadoPago(ctx: Ctx) {
  assertRole(ctx, "dono");
  await tenantTransaction(ctx, async (tx) => {
    await tx.update(tenants).set({ mpTokenEnc: null, mpConta: null }).where(eq(tenants.id, ctx.tenantId));
    await audit(tx, ctx, "empresa.mp_desconectar", "tenant", ctx.tenantId);
  });
}

// lido dentro do escopo da empresa; as chamadas ao Mercado Pago ficam fora da transação, para não segurar o banco
const lerPedido = (tenantId: string, orderId: string) =>
  withTenant(tenantId, async () => {
    const [t] = await db
      .select({ name: tenants.name, slug: tenants.slug, pixKey: tenants.pixKey, pixName: tenants.pixName, pixCity: tenants.pixCity, mpTokenEnc: tenants.mpTokenEnc })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    const [o] = await db
      .select({
        number: orders.number,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        totalCents: orders.totalCents,
        cashPartCents: orders.cashPartCents,
        pixConfirmedAt: orders.pixConfirmedAt,
        mpPaymentId: orders.mpPaymentId,
        mpPixCode: orders.mpPixCode,
        mpAmountCents: orders.mpAmountCents,
        mpExpiresAt: orders.mpExpiresAt,
      })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)));
    return t && o ? { t, o } : null;
  });

/**
 * Código Pix para o cliente pagar este pedido, ou null se não há Pix a pagar. `automatico` diz se a
 * confirmação vem sozinha (Mercado Pago) ou se alguém precisa conferir no extrato.
 */
export async function pixDoPedido(tenantId: string, orderId: string): Promise<{ codigo: string; automatico: boolean } | null> {
  if (!isUuid(orderId)) return null;
  const lido = await lerPedido(tenantId, orderId);
  if (!lido) return null;
  const { t, o } = lido;
  if (o.paymentMethod !== "pix" || o.pixConfirmedAt || !["aberto", "em_rota", "entregue"].includes(o.status)) return null;
  const valor = o.totalCents - o.cashPartCents;
  const naChave = orderPix(t, { number: o.number, totalCents: valor });
  const semMp = naChave ? { codigo: naChave, automatico: false } : null;
  if (!t.mpTokenEnc) return semMp;

  // a cobrança que já existe serve enquanto o valor é o mesmo e falta tempo para vencer
  if (o.mpPixCode && o.mpAmountCents === valor && o.mpExpiresAt && o.mpExpiresAt.getTime() > Date.now() + 10 * 60_000)
    return { codigo: o.mpPixCode, automatico: true };

  try {
    const token = decifrar(t.mpTokenEnc);
    // o total mudou (entrega parcial): a cobrança antiga não pode mais ser paga
    if (o.mpPaymentId && o.mpAmountCents !== valor) await cancelarPixMp(token, o.mpPaymentId).catch(() => {});
    const app = process.env.APP_URL ?? "";
    const expiraEm = new Date(Date.now() + PRAZO_MS);
    const novo = await criarPixMp(token, {
      valorCents: valor,
      descricao: `Pedido #${o.number}, ${t.name}`.slice(0, 120),
      referencia: orderId,
      // shortcut: o Mercado Pago exige um e-mail do pagador e o pedido não tem; vai um endereço do pedido. Conferir no sandbox.
      emailPagador: `pedido${o.number}@${t.slug}.pedidos.com.br`,
      expiraEm,
      avisoUrl: app.startsWith("https://") ? `${app}/api/mercadopago?pedido=${orderId}` : undefined,
      // mesmo pedido, mesmo valor, mesmo dia = mesma cobrança, mesmo com duas telas pedindo ao mesmo tempo
      chave: `${orderId}:${valor}:${Math.floor(Date.now() / PRAZO_MS)}`,
    });
    await withTenant(tenantId, () =>
      db
        .update(orders)
        .set({ mpPaymentId: novo.id, mpPixCode: novo.codigo, mpAmountCents: valor, mpExpiresAt: expiraEm })
        .where(and(eq(orders.id, orderId), isNull(orders.pixConfirmedAt))),
    );
    return { codigo: novo.codigo, automatico: true };
  } catch (e) {
    // Mercado Pago fora ou token revogado: o pedido não fica sem Pix, vai o da chave
    console.error(`[pix] cobrança do pedido ${orderId} no Mercado Pago falhou:`, (e as Error).message);
    return semMp;
  }
}

/**
 * Pergunta ao Mercado Pago se o Pix do pedido foi pago e, se foi, marca o pedido como pago. Só aceita o
 * pagamento que é deste pedido e deste valor. Devolve true se o pedido está pago.
 */
export async function conferirPixMp(tenantId: string, orderId: string): Promise<boolean> {
  if (!isUuid(orderId)) return false;
  const lido = await lerPedido(tenantId, orderId);
  if (!lido) return false;
  const { t, o } = lido;
  if (o.pixConfirmedAt) return true;
  if (!t.mpTokenEnc || !o.mpPaymentId || o.paymentMethod !== "pix") return false;
  let p: Awaited<ReturnType<typeof pagamentoMp>>;
  try {
    p = await pagamentoMp(decifrar(t.mpTokenEnc), o.mpPaymentId);
  } catch (e) {
    console.error(`[pix] consulta do pedido ${orderId} no Mercado Pago falhou:`, (e as Error).message);
    return false;
  }
  if (!p.pago || p.referencia !== orderId || p.valorCents !== o.mpAmountCents) return false;
  return tenantTransaction({ tenantId }, async (tx) => {
    const [ok] = await tx
      .update(orders)
      .set({ pixConfirmedAt: new Date(), pixConfirmedBy: null })
      .where(and(eq(orders.id, orderId), eq(orders.mpPaymentId, o.mpPaymentId!), isNull(orders.pixConfirmedAt)))
      .returning({ id: orders.id });
    // sem pessoa: quem confirmou foi o Mercado Pago
    if (ok) await tx.insert(auditLog).values({ tenantId, userId: null, action: "pedido.pix_mercadopago", entity: "order", entityId: orderId, data: { pagamento: o.mpPaymentId, valor: p.valorCents } });
    return true;
  });
}
