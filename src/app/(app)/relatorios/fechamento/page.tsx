import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { withTenant } from "@/db";
import { periodBreakdown, periodReport } from "@/domain/queries";
import { paymentsByDay } from "@/domain/receivables";
import { expenseCategories, listExpenses } from "@/domain/expenses";
import { resolutions } from "@/domain/shifts";
import { parsePeriod, todayISO } from "@/lib/period";
import { Difference, Money, fmtDateTime } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Fechamento do dia" };

export default async function Fechamento({ searchParams }: PageProps<"/relatorios/fechamento">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const sp = await searchParams;
  const day = typeof sp.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : todayISO();
  const { from, to } = parsePeriod({ de: day, ate: day });
  const [{ days, closed }, b, fiado, expenses] = await withTenant(user.tenantId, () =>
    Promise.all([
      periodReport(user.tenantId, from, to),
      periodBreakdown(user.tenantId, from, to),
      paymentsByDay(user.tenantId, from, to),
      listExpenses(user.tenantId, day, day),
    ]),
  );
  const d = days[0] ?? { count: 0, total: 0, cash: 0, pix: 0, card: 0, credit: 0 };
  const paid = expenses.filter((e) => !e.voidedAt && e.category !== "estorno");
  const spent = paid.reduce((s, e) => s + e.amountCents, 0);
  const fiadoIn = fiado.reduce((s, f) => s + f.total, 0);
  const diffs = closed.reduce((s, c) => s + (c.shift.differenceCents ?? 0), 0);
  const longDay = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date(`${day}T12:00:00-03:00`));

  return (
    <div className="print-sheet mx-auto max-w-3xl">
      <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/relatorios" className="text-accent hover:underline">Relatórios</Link>
          <span className="text-muted">/</span>
          <h1 className="h1">Fechamento do dia</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <form className="flex items-end gap-2">
            <div>
              <label className="label" htmlFor="dia">Dia</label>
              <input id="dia" name="dia" type="date" defaultValue={day} max={todayISO()} className="input" />
            </div>
            <button className="btn">Ver</button>
          </form>
          <PrintButton />
        </div>
      </div>

      <header className="mb-6 border-b border-line pb-4">
        <p className="text-[13px] text-muted">{user.tenantName}</p>
        <p className="text-xl font-semibold first-letter:uppercase">Fechamento de {longDay}</p>
        <p className="text-[13px] text-muted">Emitido em {fmtDateTime(new Date())} por {user.name}</p>
      </header>

      <Block title="Vendas entregues">
        <Row label={`${d.count} ${d.count === 1 ? "pedido" : "pedidos"}`} cents={d.total} strong />
        <Row label="Dinheiro" cents={d.cash} />
        <Row label="Pix" cents={d.pix} />
        <Row label="Cartão" cents={d.card} />
        <Row label="Fiado (a receber)" cents={d.credit} />
        {b.discounts > 0 && <Row label="Descontos já abatidos das vendas" cents={b.discounts} muted />}
      </Block>

      <Block title="Por produto">
        {b.byProduct.length ? b.byProduct.map((p) => <Row key={p.name} label={`${p.qty} x ${p.name}`} cents={p.total} />) : <None />}
      </Block>

      <Block title="Por entregador">
        {b.byDriver.length ? (
          b.byDriver.map((r) => <Row key={r.name} label={`${r.name}, ${r.count} ${r.count === 1 ? "pedido" : "pedidos"}`} cents={r.total} />)
        ) : (
          <None />
        )}
      </Block>

      <Block title="Acertos de caixa fechados no dia">
        {closed.length ? (
          <>
            {closed.map(({ shift: s, driverName }) => (
              <div key={s.id} className="flex flex-wrap justify-between gap-x-4 border-b border-line py-1.5 last:border-0">
                <span>
                  {driverName}: esperado <Money cents={s.expectedCashCents ?? 0} />, contado <Money cents={s.countedCashCents ?? 0} />
                  {s.differenceCents ? (
                    <span className="block text-[13px] text-muted">
                      {s.resolvedAt ? `Resolvido: ${resolutions[s.resolution as keyof typeof resolutions] ?? s.resolution}. ${s.resolutionNotes ?? ""}` : `Pendente. ${s.closingNotes}`}
                    </span>
                  ) : null}
                </span>
                <Difference cents={s.differenceCents ?? 0} />
              </div>
            ))}
            <div className="flex justify-between pt-2 font-semibold">
              <span>Saldo das diferenças</span>
              <Difference cents={diffs} />
            </div>
          </>
        ) : (
          <None />
        )}
      </Block>

      <Block title="Despesas pagas no dia">
        {paid.length ? (
          <>
            {paid.map((e) => (
              <Row key={e.id} label={`${expenseCategories[e.category as keyof typeof expenseCategories] ?? e.category}: ${e.description}`} cents={e.amountCents} />
            ))}
            <Row label="Total de despesas" cents={spent} strong />
          </>
        ) : (
          <None />
        )}
      </Block>

      <Block title="Resumo">
        <Row label="Vendas entregues" cents={d.total} />
        <Row label="Despesas" cents={spent ? -spent : 0} />
        <Row label="Resultado do dia" cents={d.total - spent} strong />
        <Row label="Fiado recebido hoje (venda de outro dia)" cents={fiadoIn} muted />
        <p className="pt-2 text-[13px] text-muted">
          Fora do normal: {b.cancelled} {b.cancelled === 1 ? "cancelado" : "cancelados"}, {b.refunded} {b.refunded === 1 ? "estornado" : "estornados"},{" "}
          {b.occurrences} {b.occurrences === 1 ? "tentativa de entrega sem sucesso" : "tentativas de entrega sem sucesso"} e {b.partials}{" "}
          {b.partials === 1 ? "entrega parcial" : "entregas parciais"}.
        </p>
      </Block>

      <div className="mt-12 hidden grid-cols-2 gap-12 text-center text-[13px] print:grid">
        <p className="border-t border-fg pt-2">Conferido por</p>
        <p className="border-t border-fg pt-2">Responsável</p>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <div className="panel px-4 py-2">{children}</div>
    </section>
  );
}

function Row({ label, cents, strong, muted }: { label: string; cents: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 border-b border-line py-1.5 last:border-0 ${strong ? "font-semibold" : ""} ${muted ? "text-muted" : ""}`}>
      <span>{label}</span>
      <Money cents={cents} />
    </div>
  );
}

const None = () => <p className="py-1.5 text-muted">Nada no dia.</p>;
