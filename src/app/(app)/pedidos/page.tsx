import Link from "next/link";
import { Plus, Search, ReceiptText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { countOrdersByStatus, listOrders } from "@/domain/queries";
import { Money, PageHeader, StatusBadge, fmtDateTime, paymentLabel } from "@/components/ui";

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
  const sp = await searchParams;
  const current = tabs.find(([v]) => v === sp.status)?.[0] ?? "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const [orders, counts] = await Promise.all([
    listOrders(user.tenantId, { status: current || undefined, q }),
    countOrdersByStatus(user.tenantId),
  ]);
  const href = (status: string) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    return `/pedidos${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Pedidos">
        <Link href="/pedidos/novo" className="btn btn-primary">
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Novo pedido
        </Link>
      </PageHeader>

      <nav aria-label="Filtrar por situação" className="mb-5 flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line">
        {tabs.map(([v, l]) => {
          const on = current === v;
          const n = v ? (counts[v] ?? 0) : counts.total;
          return (
            <Link
              key={v}
              href={href(v)}
              aria-current={on ? "page" : undefined}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-[13px] font-medium transition-colors ${
                on ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {l}
              <span className="num text-xs text-muted">{n}</span>
            </Link>
          );
        })}
      </nav>

      <form className="mb-4 flex flex-wrap items-center justify-between gap-3" role="search">
        {current && <input type="hidden" name="status" value={current} />}
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Buscar pedido</span>
          <Search size={15} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder="Cliente ou número do pedido" className="input pl-9" />
        </label>
        <p className="text-[13px] text-muted">
          {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
        </p>
      </form>

      <div className="panel overflow-x-auto">
        {orders.length ? (
          <table className="table min-w-[46rem]">
            <thead>
              <tr>
                <th className="w-16">Nº</th>
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
                <tr key={o.id}>
                  <td className="num text-muted">
                    <Link href={`/pedidos/${o.id}`} className="hover:text-fg">#{o.number}</Link>
                  </td>
                  <td>
                    <Link href={`/pedidos/${o.id}`} className="font-medium hover:underline">{o.customerName ?? "Balcão"}</Link>
                    {o.customerAddress && <p className="text-[13px] text-muted">{o.customerAddress}</p>}
                  </td>
                  <td>{o.driverName ?? <span className="text-muted">-</span>}</td>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(o.createdAt)}</td>
                  <td>{paymentLabel[o.paymentMethod]}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="text-right font-medium"><Money cents={o.totalCents} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <ReceiptText size={28} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
            <p className="mt-3 font-medium">{q ? `Nada encontrado para "${q}"` : "Nenhum pedido nesta situação"}</p>
            <p className="mt-1 text-muted">
              {q ? "Confira o nome ou busque pelo número do pedido." : "Os pedidos lançados aparecem aqui conforme mudam de situação."}
            </p>
            <Link href={q ? (current ? `/pedidos?status=${current}` : "/pedidos") : "/pedidos/novo"} className="btn mt-5">
              {q ? "Limpar busca" : "Lançar pedido"}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
