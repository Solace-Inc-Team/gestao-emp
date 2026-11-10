import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { dashboard } from "@/domain/queries";
import { Money, StatusBadge, Empty, fmtTime, paymentLabel } from "@/components/ui";

export const metadata = { title: "Painel" };

export default async function Painel() {
  const user = await requireUser("dono", "atendente", "caixa");
  const d = await dashboard(user.tenantId);
  const hoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted first-letter:uppercase">{hoje}</p>
          <h1 className="h1">Painel do dia</h1>
        </div>
        <Link href="/pedidos/novo" className="btn btn-primary">Novo pedido</Link>
      </div>

      <section className="panel mb-6 grid divide-line sm:grid-cols-3 sm:divide-x">
        <div className="p-5">
          <p className="text-muted">Vendido hoje</p>
          <Money cents={d.revenue} className="text-[2rem] leading-tight font-semibold tracking-[-0.03em]" />
          <p className="mt-1 text-sm text-muted">{d.deliveredCount} pedidos entregues</p>
        </div>
        <div className="border-t border-line p-5 sm:border-t-0">
          <p className="text-muted">Dinheiro na rua</p>
          <Money cents={d.cashInStreet} className="text-[2rem] leading-tight font-semibold tracking-[-0.03em]" />
          <p className="mt-1 text-sm text-muted">
            com {d.openShifts.length} {d.openShifts.length === 1 ? "entregador" : "entregadores"}, a acertar
          </p>
        </div>
        <div className="border-t border-line p-5 sm:border-t-0">
          <p className="text-muted">Fila agora</p>
          <p className="num text-[2rem] leading-tight font-semibold tracking-[-0.03em]">
            {d.pending} <span className="text-xl font-medium text-muted">aguardando</span>
          </p>
          <p className="mt-1 text-sm text-muted">{d.inRoute} em rota</p>
        </div>
      </section>

      {user.role === "dono" && !user.totpEnabled && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <p className="flex items-center gap-2.5 text-[13px]">
            <ShieldAlert size={16} strokeWidth={1.75} className="shrink-0 text-warn" aria-hidden="true" />
            Proteja o acesso ao caixa: ative a verificação em duas etapas.
          </p>
          <Link href="/senha" className="btn h-8 text-[13px]">Ativar</Link>
        </div>
      )}

      {(d.pendingDifferences > 0 || d.lowStock.length > 0 || d.late > 0 || d.returned > 0) && (
        <section aria-label="Alertas" className="mb-6 space-y-2">
          {d.late > 0 && (
            <Link href="/entregas" className="flex items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-danger">
              <span className="font-semibold">
                {d.late} {d.late === 1 ? "pedido atrasado" : "pedidos atrasados"}
              </span>
              <span className="text-sm underline">Ver entregas</span>
            </Link>
          )}
          {d.returned > 0 && (
            <Link href="/entregas" className="flex items-center justify-between gap-3 rounded-md border border-warn/40 bg-warn-soft px-4 py-3 text-warn-fg">
              <span className="font-semibold">
                {d.returned} {d.returned === 1 ? "pedido voltou" : "pedidos voltaram"} da rua sem entrega
              </span>
              <span className="text-sm underline">Resolver</span>
            </Link>
          )}
          {d.pendingDifferences > 0 && (
            <Link href="/caixa" className="flex items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-danger">
              <span className="font-semibold">
                {d.pendingDifferences} {d.pendingDifferences === 1 ? "acerto com diferença esperando" : "acertos com diferença esperando"} resolução
              </span>
              <span className="text-sm underline">Ver acertos</span>
            </Link>
          )}
          {d.lowStock.map((p) => (
            <Link key={p.id} href="/estoque" className="flex items-center justify-between gap-3 rounded-md border border-warn/40 bg-warn-soft px-4 py-3 text-warn-fg">
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
            <Link href="/pedidos" className="text-sm text-accent hover:underline">Ver todos</Link>
          </div>
          {d.recent.length ? (
            <table className="table">
              <tbody>
                {d.recent.map((o) => (
                  <tr key={o.id}>
                    <td className="num w-12 text-muted">#{o.number}</td>
                    <td>
                      <Link href={`/pedidos/${o.id}`} className="font-medium hover:text-accent">
                        {o.customerName ?? "Balcão"}
                      </Link>
                      <p className="text-sm text-muted">
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
            <Empty>Nenhum pedido hoje. <Link href="/pedidos/novo" className="text-accent underline">Lançar o primeiro</Link></Empty>
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
                      <p className="text-sm text-muted">
                        {s.orderCount} {s.orderCount === 1 ? "pedido" : "pedidos"}, {s.inRoute} em rota
                      </p>
                    </div>
                    <Link href={`/caixa/${s.id}`} className="text-right">
                      <Money cents={s.expected} className="block font-semibold" />
                      <span className="text-sm text-accent">Fazer acerto</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhum turno aberto. <Link href="/caixa" className="text-accent underline">Abrir turno</Link></Empty>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="h2 mb-3">Recebido por forma de pagamento</h2>
            <dl className="space-y-1.5">
              {(Object.keys(paymentLabel) as (keyof typeof paymentLabel)[]).map((k) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-muted">{paymentLabel[k]}</dt>
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
