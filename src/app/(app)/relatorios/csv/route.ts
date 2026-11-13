import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders, users } from "@/db/schema";
import { getUser, pendingTerms } from "@/lib/auth";
import { parsePeriod } from "@/lib/period";
import { filialDoRelatorio } from "@/lib/filial";
import { reais, toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user || user.role === "entregador" || pendingTerms(user)) return new Response("Não autorizado", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { fromStr, toStr, from, to } = parsePeriod(sp);
  const filial = filialDoRelatorio(user, sp);
  const rows = await db
    .select({
      number: orders.number,
      deliveredAt: orders.deliveredAt,
      customer: customers.name,
      driver: users.name,
      payment: orders.paymentMethod,
      cashPart: orders.cashPartCents,
      discount: orders.discountCents,
      origin: orders.origin,
      total: orders.totalCents,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(users, eq(users.id, orders.driverId))
    .where(and(eq(orders.tenantId, user.tenantId), filial ? eq(orders.branchId, filial) : undefined, eq(orders.status, "entregue"), gte(orders.deliveredAt, from), lt(orders.deliveredAt, to)))
    .orderBy(asc(orders.deliveredAt));

  const csv = toCsv(
    ["Pedido", "Entregue em", "Cliente", "Entregador", "Origem", "Pagamento", "Parte em dinheiro", "Desconto", "Total"],
    rows.map((r) => [r.number, r.deliveredAt, r.customer ?? "Balcão", r.driver ?? "", r.origin, r.payment, reais(r.cashPart), reais(r.discount), reais(r.total)]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendas_${fromStr}_${toStr}.csv"`,
    },
  });
}
