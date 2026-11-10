import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { periodReport } from "@/domain/queries";
import { parsePeriod } from "@/lib/period";
import { paymentsByDay } from "@/domain/receivables";
import { expensesTotal } from "@/domain/expenses";
import { Difference, Empty, Money, PageHeader, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Relatórios" };

export default async function Relatorios({ searchParams }: PageProps<"/relatorios">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const { fromStr, toStr, from, to } = parsePeriod(await searchParams);
  const [{ days, closed }, fiadoPaid, spent] = await Promise.all([
    periodReport(user.tenantId, from, to),
    paymentsByDay(user.tenantId, from, to),
    expensesTotal(user.tenantId, fromStr, toStr, true),
  ]);
  const fiadoTotal = fiadoPaid.reduce((s, d) => s + d.total, 0);
  const sum = (k: "total" | "cash" | "pix" | "card" | "credit" | "count") => days.reduce((s, d) => s + d[k], 0);
  const diffTotal = closed.reduce((s, c) => s + (c.shift.differenceCents ?? 0), 0);
  const fmtDay = (d: string) => d.split("-").reverse().join("/");

  return (
    <>
      <PageHeader title="Relatórios">
        <Link href={`/relatorios/csv?de=${fromStr}&ate=${toStr}`} className="btn">Baixar vendas em CSV</Link>
        {user.role === "dono" && (
          // <a> e não <Link>: é download de arquivo, não navegação
          <a href="/exportar" className="btn" title="Todos os dados da empresa em planilhas, num ZIP">Exportar todos os dados</a>
        )}
      </PageHeader>
      <form className="panel mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="de">De</label>
          <input id="de" name="de" type="date" defaultValue={fromStr} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ate">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={toStr} className="input" />
        </div>
        <button className="btn btn-primary">Ver período</button>
      </form>

      <section className="panel mb-6 overflow-x-auto">
        <h2 className="h2 border-b border-line px-4 py-3">Vendas entregues por dia</h2>
        {days.length ? (
          <table className="table min-w-[44rem]">
            <thead>
              <tr>
                <th>Dia</th><th className="text-right">Pedidos</th><th className="text-right">Dinheiro</th><th className="text-right">Pix</th>
                <th className="text-right">Cartão</th><th className="text-right">Fiado</th><th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day}>
                  <td className="num">{fmtDay(d.day)}</td>
                  <td className="num text-right">{d.count}</td>
                  <td className="text-right"><Money cents={d.cash} /></td>
                  <td className="text-right"><Money cents={d.pix} /></td>
                  <td className="text-right"><Money cents={d.card} /></td>
                  <td className="text-right"><Money cents={d.credit} /></td>
                  <td className="text-right font-semibold"><Money cents={d.total} /></td>
                </tr>
              ))}
              <tr className="bg-subtle font-semibold">
                <td>Período</td>
                <td className="num text-right">{sum("count")}</td>
                <td className="text-right"><Money cents={sum("cash")} /></td>
                <td className="text-right"><Money cents={sum("pix")} /></td>
                <td className="text-right"><Money cents={sum("card")} /></td>
                <td className="text-right"><Money cents={sum("credit")} /></td>
                <td className="text-right"><Money cents={sum("total")} /></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <Empty>Nenhuma venda entregue neste período.</Empty>
        )}
      </section>

      <section className="panel mb-6 grid sm:grid-cols-3 sm:divide-x sm:divide-line">
        <div className="p-5">
          <p className="text-[13px] text-muted">Vendas entregues</p>
          <Money cents={sum("total")} className="mt-1 block text-2xl font-semibold tracking-[-0.03em]" />
        </div>
        <div className="border-t border-line p-5 sm:border-t-0">
          <p className="text-[13px] text-muted">
            <Link href={`/despesas?de=${fromStr}&ate=${toStr}`} className="hover:text-fg hover:underline">Despesas</Link>
          </p>
          <Money cents={spent} className="mt-1 block text-2xl font-semibold tracking-[-0.03em]" />
        </div>
        <div className="border-t border-line p-5 sm:border-t-0">
          <p className="text-[13px] text-muted">Resultado (vendas menos despesas)</p>
          <Money
            cents={sum("total") - spent}
            className={`mt-1 block text-2xl font-semibold tracking-[-0.03em] ${sum("total") - spent < 0 ? "text-danger" : ""}`}
          />
        </div>
        <p className="border-t border-line px-5 py-3 text-[13px] text-muted sm:col-span-3">
          Fiado recebido no período: <Money cents={fiadoTotal} className="font-medium text-fg" />. Já contado como venda no dia da entrega. Devoluções de pedidos estornados não entram nas despesas acima, porque a venda estornada já saiu das vendas.
        </p>
      </section>

      <section className="panel overflow-x-auto">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="h2">Acertos no período</h2>
          {closed.length > 0 && <p>Saldo das diferenças: <Difference cents={diffTotal} /></p>}
        </div>
        {closed.length ? (
          <table className="table min-w-[40rem]">
            <thead><tr><th>Entregador</th><th>Fechado em</th><th className="text-right">Esperado</th><th className="text-right">Contado</th><th className="text-right">Resultado</th></tr></thead>
            <tbody>
              {closed.map(({ shift: s, driverName }) => (
                <tr key={s.id}>
                  <td><Link href={`/caixa/${s.id}`} className="hover:text-accent">{driverName}</Link></td>
                  <td>{fmtDateTime(s.closedAt)}</td>
                  <td className="text-right"><Money cents={s.expectedCashCents ?? 0} /></td>
                  <td className="text-right"><Money cents={s.countedCashCents ?? 0} /></td>
                  <td className="text-right"><Difference cents={s.differenceCents ?? 0} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Nenhum acerto fechado neste período.</Empty>
        )}
      </section>
    </>
  );
}
