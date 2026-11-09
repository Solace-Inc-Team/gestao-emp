import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listOrders } from "@/domain/queries";
import { Money, PageHeader, StatusBadge, Empty, fmtDateTime, paymentLabel } from "@/components/ui";

export const metadata = { title: "Pedidos" };

const tabs = [
  ["", "Todos"],
  ["aberto", "Aguardando"],
  ["em_rota", "Em rota"],
  ["entregue", "Entregues"],
  ["cancelado", "Cancelados"],
] as const;

export default async function Pedidos({ searchParams }: PageProps<"/pedidos">) {
  const user = await requireUser("dono", "atendente");
  const { status } = await searchParams;
  const current = tabs.find(([v]) => v === status)?.[0] ?? "";
  const orders = await listOrders(user.tenantId, { status: current || undefined });

  return (
    <>
      <PageHeader title="Pedidos">
        <Link href="/pedidos/novo" className="btn btn-primary">Novo pedido</Link>
      </PageHeader>
      <nav aria-label="Filtrar por situação" className="mb-4 flex gap-1 overflow-x-auto">
        {tabs.map(([v, l]) => (
          <Link
            key={v}
            href={v ? `/pedidos?status=${v}` : "/pedidos"}
            aria-current={current === v ? "page" : undefined}
            className={`shrink-0 rounded-md px-3 py-1.5 font-medium ${current === v ? "bg-ink text-white" : "text-ink-soft hover:bg-white"}`}
          >
            {l}
          </Link>
        ))}
      </nav>
      <div className="panel overflow-x-auto">
        {orders.length ? (
          <table className="table min-w-[44rem]">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Cliente</th>
                <th>Entregador</th>
                <th>Lançado</th>
                <th>Pagamento</th>
                <th>Situação</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-paper">
                  <td className="num text-ink-soft">
                    <Link href={`/pedidos/${o.id}`} className="hover:text-water">#{o.number}</Link>
                  </td>
                  <td>
                    <Link href={`/pedidos/${o.id}`} className="font-medium hover:text-water">{o.customerName ?? "Balcão"}</Link>
                    {o.customerAddress && <p className="text-sm text-ink-soft">{o.customerAddress}</p>}
                  </td>
                  <td>{o.driverName ?? <span className="text-ink-soft">-</span>}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(o.createdAt)}</td>
                  <td>{paymentLabel[o.paymentMethod]}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="text-right"><Money cents={o.totalCents} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Nenhum pedido nesta situação.</Empty>
        )}
      </div>
    </>
  );
}
