import { filialDoRelatorio } from "@/lib/filial";
import { CampoFilial } from "@/components/campo-filial";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { periodBreakdown, periodReport } from "@/domain/queries";
import { parsePeriod } from "@/lib/period";
import { paymentsByDay } from "@/domain/receivables";
import { expensesTotal } from "@/domain/expenses";
import { Difference, Empty, Money, PageHeader, fmtDateTime } from "@/components/ui";
import { DivisaoPagamento } from "@/components/divisao-pagamento";

export const metadata = { title: "Relatórios" };

export default async function Relatorios({ searchParams }: PageProps<"/relatorios">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const sp = await searchParams;
  const { fromStr, toStr, from, to } = parsePeriod(sp);
  const filial = filialDoRelatorio(user, sp);
  const [{ days, closed }, breakdown, fiadoPaid, spent] = await Promise.all([
    periodReport(user.tenantId, from, to, filial),
    periodBreakdown(user.tenantId, from, to, filial),
    paymentsByDay(user.tenantId, from, to, filial),
    expensesTotal(user.tenantId, fromStr, toStr, filial, true),
  ]);
  const fiadoTotal = fiadoPaid.reduce((s, d) => s + d.total, 0);
  const sum = (k: "total" | "cash" | "pix" | "card" | "credit" | "count") => days.reduce((s, d) => s + d[k], 0);
  const diffTotal = closed.reduce((s, c) => s + (c.shift.differenceCents ?? 0), 0);
  const fmtDay = (d: string) => d.split("-").reverse().join("/");
  // a filial escolhida vai junto para o fechamento e para o CSV
  const todas = filial === null && user.branches.length > 1 ? "&filial=todas" : "";

  return (
    <>
      <PageHeader title="Relatórios">
        <Link href={`/relatorios/fechamento?dia=${toStr}${todas}`} className="btn">Fechamento do dia</Link>
        <Link href={`/relatorios/csv?de=${fromStr}&ate=${toStr}${todas}`} className="btn">Baixar vendas em CSV</Link>
        {user.role === "dono" && (
          // <a> e não <Link>: é download de arquivo, não navegação
          <a href="/exportar" className="btn" title="Todos os dados da empresa em planilhas, num ZIP">Exportar todos os dados</a>
        )}
      </PageHeader>
      <p className="-mt-3 mb-4 text-[13px] text-muted sm:hidden">No celular, arraste as tabelas para o lado para ver todas as colunas.</p>
      <form className="panel mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="de">De</label>
          <input id="de" name="de" type="date" defaultValue={fromStr} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ate">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={toStr} className="input" />
        </div>
        <CampoFilial user={user} valor={sp.filial} />
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

      {/* divisória só entre os três números: a barra e a nota embaixo ocupam a largura toda e não levam borda lateral */}
      <section className="panel mb-6 grid sm:grid-cols-3">
        <div className="p-5 sm:border-r sm:border-line">
          <p className="text-[13px] text-muted">Vendas entregues</p>
          <Money cents={sum("total")} className="mt-1 block text-2xl font-semibold tracking-[-0.03em]" />
        </div>
        <div className="border-t border-line p-5 sm:border-t-0 sm:border-r">
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
        <DivisaoPagamento
          className="border-t border-line p-5 sm:col-span-3"
          partes={[
            { rotulo: "Dinheiro", cents: sum("cash") },
            { rotulo: "Pix", cents: sum("pix") },
            { rotulo: "Cartão", cents: sum("card") },
            { rotulo: "Fiado", cents: sum("credit") },
          ]}
        />
        <p className="border-t border-line px-5 py-3 text-[13px] text-muted sm:col-span-3">
          Fiado recebido no período: <Money cents={fiadoTotal} className="font-medium text-fg" />. Já contado como venda no dia da entrega. Devoluções de pedidos estornados não entram nas despesas acima, porque a venda estornada já saiu das vendas.
        </p>
      </section>

      <div className="mb-6 grid gap-6">
        <section className="panel overflow-x-auto">
          <h2 className="h2 border-b border-line px-4 py-3">Por entregador</h2>
          {breakdown.byDriver.length ? (
            <table className="table min-w-[32rem]">
              <thead>
                <tr>
                  <th>Quem entregou</th><th className="text-right">Pedidos</th><th className="text-right">Itens</th><th className="text-right">Dinheiro</th>
                  <th className="text-right">Pix</th><th className="text-right">Cartão</th><th className="text-right">Fiado</th><th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.byDriver.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="num text-right">{r.count}</td>
                    <td className="num text-right">{r.units}</td>
                    <td className="text-right"><Money cents={r.cash} /></td>
                    <td className="text-right"><Money cents={r.pix} /></td>
                    <td className="text-right"><Money cents={r.card} /></td>
                    <td className="text-right"><Money cents={r.credit} /></td>
                    <td className="text-right font-semibold"><Money cents={r.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Sem entregas no período.</Empty>
          )}
        </section>
        <section className="panel overflow-x-auto">
          <h2 className="h2 border-b border-line px-4 py-3">Por produto</h2>
          {breakdown.byProduct.length ? (
            <table className="table min-w-[32rem]">
              <thead><tr><th>Produto</th><th className="text-right">Qtd.</th><th className="text-right">Sem troca de vasilhame</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {breakdown.byProduct.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="num text-right">{r.qty}</td>
                    <td className="num text-right text-muted">{r.noReturn || "-"}</td>
                    <td className="text-right font-semibold"><Money cents={r.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Sem vendas no período.</Empty>
          )}
        </section>
      </div>

      <section className="panel mb-6 grid grid-cols-2 sm:grid-cols-6 sm:divide-x sm:divide-line" aria-label="Fora do normal no período">
        {(
          [
            ["Cancelados", breakdown.cancelled],
            ["Estornados", breakdown.refunded],
            ["Voltaram da rua", breakdown.occurrences],
            ["Entregas parciais", breakdown.partials],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="p-4">
            <p className="text-[13px] text-muted">{label}</p>
            <p className="num mt-1 text-xl font-semibold">{n}</p>
          </div>
        ))}
        <div className="p-4">
          <p className="text-[13px] text-muted">Descontos dados</p>
          <Money cents={breakdown.discounts} className="mt-1 block text-xl font-semibold" />
        </div>
        <div className="p-4">
          <p className="text-[13px] text-muted">Taxas de entrega</p>
          <Money cents={breakdown.fees} className="mt-1 block text-xl font-semibold" />
        </div>
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
