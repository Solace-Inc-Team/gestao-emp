import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dashboard } from "@/domain/queries";
import { Money, StatusBadge, Empty, fmtTime, paymentLabel } from "@/components/ui";

export const metadata = { title: "Painel" };

export default async function Painel() {
  const user = await requireUser("dono", "atendente");
  const d = await dashboard(user.tenantId);
  const hoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-ink-soft first-letter:uppercase">{hoje}</p>
          <h1 className="h1">Painel do dia</h1>
        </div>
        <Link href="/pedidos/novo" className="btn btn-primary">Novo pedido</Link>
      </div>

      <section className="panel mb-6 grid divide-line sm:grid-cols-3 sm:divide-x">
        <div className="p-5">
          <p className="text-ink-soft">Vendido hoje</p>
          <Money cents={d.revenue} className="text-4xl font-semibold" />
          <p className="mt-1 text-sm text-ink-soft">{d.deliveredCount} pedidos entregues</p>
        </div>
        <div className="border-t border-line p-5 sm:border-t-0">
          <p className="text-ink-soft">Dinheiro na rua</p>
          <Money cents={d.cashInStreet} className="text-4xl font-semibold text-water" />
          <p className="mt-1 text-sm text-ink-soft">
            com {d.openShifts.length} {d.openShifts.length === 1 ? "entregador" : "entregadores"}, a acertar
          </p>
        </div>
        <div className="border-t border-line p-5 sm:border-t-0">
          <p className="text-ink-soft">Fila agora</p>
          <p className="num text-4xl font-semibold">
            {d.pending} <span className="text-xl font-medium text-ink-soft">aguardando</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">{d.inRoute} em rota</p>
        </div>
      </section>

      {(d.divergentLast7 > 0 || d.lowStock.length > 0) && (
        <section aria-label="Alertas" className="mb-6 space-y-2">
          {d.divergentLast7 > 0 && (
            <Link href="/caixa" className="flex items-center justify-between gap-3 rounded-md border border-short/30 bg-short-soft px-4 py-3 text-short">
              <span className="font-semibold">
                {d.divergentLast7} {d.divergentLast7 === 1 ? "acerto fechou" : "acertos fecharam"} com diferença nos últimos 7 dias
              </span>
              <span className="text-sm underline">Ver acertos</span>
            </Link>
          )}
          {d.lowStock.map((p) => (
            <Link key={p.id} href="/estoque" className="flex items-center justify-between gap-3 rounded-md border border-gas/40 bg-gas-soft px-4 py-3 text-[#7a5200]">
              <span className="font-semibold">
                {p.name}: {p.fullStore} cheios na loja (mínimo {p.minStock})
              </span>
              <span className="text-sm underline">Ver estoque</span>
            </Link>
          ))}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="h2">Pedidos de hoje</h2>
            <Link href="/pedidos" className="text-sm text-water hover:underline">Ver todos</Link>
          </div>
          {d.recent.length ? (
            <table className="table">
              <tbody>
                {d.recent.map((o) => (
                  <tr key={o.id}>
                    <td className="num w-12 text-ink-soft">#{o.number}</td>
                    <td>
                      <Link href={`/pedidos/${o.id}`} className="font-medium hover:text-water">
                        {o.customerName ?? "Balcão"}
                      </Link>
                      <p className="text-sm text-ink-soft">
                        {fmtTime(o.createdAt)}
                        {o.driverName ? `, ${o.driverName}` : ""}
                      </p>
                    </td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right"><Money cents={o.totalCents} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Nenhum pedido hoje. <Link href="/pedidos/novo" className="text-water underline">Lançar o primeiro</Link></Empty>
          )}
        </section>

        <div className="space-y-6">
          <section className="panel">
            <h2 className="h2 border-b border-line px-4 py-3">Entregadores em turno</h2>
            {d.openShifts.length ? (
              <ul>
                {d.openShifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                    <div>
                      <p className="font-medium">{s.driverName}</p>
                      <p className="text-sm text-ink-soft">
                        {s.orderCount} {s.orderCount === 1 ? "pedido" : "pedidos"}, {s.inRoute} em rota
                      </p>
                    </div>
                    <Link href={`/caixa/${s.id}`} className="text-right">
                      <Money cents={s.expected} className="block font-semibold" />
                      <span className="text-sm text-water">Fazer acerto</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhum turno aberto. <Link href="/caixa" className="text-water underline">Abrir turno</Link></Empty>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="h2 mb-3">Recebido por forma de pagamento</h2>
            <dl className="space-y-1.5">
              {(Object.keys(paymentLabel) as (keyof typeof paymentLabel)[]).map((k) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-ink-soft">{paymentLabel[k]}</dt>
                  <dd><Money cents={d.byMethod[k]} /></dd>
                </div>
              ))}
            </dl>
            {d.sold.length > 0 && (
              <>
                <h3 className="mt-5 mb-2 font-semibold">Saiu hoje</h3>
                <ul className="space-y-1">
                  {d.sold.map((s) => (
                    <li key={s.name} className="flex justify-between">
                      <span>{s.name}</span>
                      <span className="num font-semibold">{s.qty}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
