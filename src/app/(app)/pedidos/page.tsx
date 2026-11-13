import Link from "next/link";
import { ViewTransition } from "react";
import { Plus, Search, ReceiptText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { countOrdersByStatus, listOrders } from "@/domain/queries";
import { Money, PageHeader, SiteBadge, StatusBadge, fmtDateTime, paymentLabel } from "@/components/ui";

export const metadata = { title: "Pedidos" };

// pedido lançado há menos de um minuto acende na lista
const isNew = (d: Date) => Date.now() - d.getTime() < 60_000;

const tabs = [
  ["", "Todos"],
  ["aberto", "Aguardando"],
  ["em_rota", "Em rota"],
  ["entregue", "Entregues"],
  ["cancelado", "Cancelados"],
  ["estornado", "Estornados"],
] as const;

export default async function Pedidos({ searchParams }: PageProps<"/pedidos">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const sp = await searchParams;
  const current = tabs.find(([v]) => v === sp.status)?.[0] ?? "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const [orders, counts] = await Promise.all([
    listOrders(user.tenantId, { status: current || undefined, q, branchId: user.branchId }),
    countOrdersByStatus(user.tenantId, user.branchId),
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
              className={`relative flex min-h-11 shrink-0 items-center gap-1.5 pb-1 text-[13px] sm:min-h-0 sm:pb-2.5 font-medium transition-colors ${
                on ? "text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {l}
              <span className="num text-xs text-muted">{n}</span>
              {/* o traço da aba ativa é um só: ao trocar de filtro ele corre da aba antiga até a clicada */}
              {on && (
                <ViewTransition name="aba-pedidos" share="move" default="none">
                  <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 bg-fg" />
                </ViewTransition>
              )}
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
          <>
          {/* no celular, cartão por pedido: o que importa na primeira linha, o resto embaixo */}
          <ul className="sm:hidden">
            {orders.map((o) => (
              <li key={o.id} className={`border-b border-line last:border-0 ${isNew(o.createdAt) ? "row-new" : ""}`}>
                <Link href={`/pedidos/${o.id}`} className="block px-4 py-3 active:bg-subtle">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">
                      <span className="num font-normal text-muted">#{o.number}</span> {o.customerName ?? "Balcão"}
                    </span>
                    <Money cents={o.totalCents} className="shrink-0 font-medium" />
                  </span>
                  {o.customerAddress && <span className="mt-0.5 block truncate text-[13px] text-muted">{o.customerAddress}</span>}
                  <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                    <StatusBadge status={o.status} />
                    {o.origin === "portal" && <SiteBadge />}
                    <span>
                      {paymentLabel[o.paymentMethod]}
                      {o.driverName ? `, ${o.driverName}` : ""}, {fmtDateTime(o.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
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
                <tr key={o.id} className={isNew(o.createdAt) ? "row-new" : undefined}>
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
                  <td><StatusBadge status={o.status} />{o.origin === "portal" && <SiteBadge />}</td>
                  <td className="text-right font-medium"><Money cents={o.totalCents} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
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
