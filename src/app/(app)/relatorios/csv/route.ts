import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders, users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { parsePeriod } from "@/lib/period";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  // prefixo ' evita que o Excel interprete como fórmula
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[;"\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: Request) {
  const user = await getUser();
  if (!user || user.role === "entregador") return new Response("Não autorizado", { status: 401 });
  const { fromStr, toStr, from, to } = parsePeriod(Object.fromEntries(new URL(req.url).searchParams));
  const rows = await db
    .select({
      number: orders.number,
      deliveredAt: orders.deliveredAt,
      customer: customers.name,
      driver: users.name,
      payment: orders.paymentMethod,
      total: orders.totalCents,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(users, eq(users.id, orders.driverId))
    .where(and(eq(orders.tenantId, user.tenantId), eq(orders.status, "entregue"), gte(orders.deliveredAt, from), lt(orders.deliveredAt, to)))
    .orderBy(asc(orders.deliveredAt));

  const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const lines = [
    ["Pedido", "Entregue em", "Cliente", "Entregador", "Pagamento", "Total"],
    ...rows.map((r) => [r.number, r.deliveredAt ? dt.format(r.deliveredAt) : "", r.customer ?? "Balcão", r.driver ?? "", r.payment, (r.total / 100).toFixed(2).replace(".", ",")]),
  ];
  // ; e BOM pro Excel em pt-BR abrir certo
  const csv = "\uFEFF" + lines.map((l) => l.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendas_${fromStr}_${toStr}.csv"`,
    },
  });
}
