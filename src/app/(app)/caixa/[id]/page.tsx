import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/ctx";
import { requireUser } from "@/lib/auth";
import { getShift } from "@/domain/queries";
import { Difference, Money, StatusBadge, fmtDateTime, paymentLabel } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PopoverForm } from "@/components/popover-form";
import { cashEntryAction, resolveDifferenceAction, voidCashEntryAction } from "@/app/actions";
import { expenseCategories } from "@/domain/expenses";
import { resolutions } from "@/domain/shifts";
import { formatBRL } from "@/lib/money";
import { CloseShiftForm } from "./close-form";

export const metadata = { title: "Acerto" };

export default async function Acerto({ params }: PageProps<"/caixa/[id]">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const s = await getShift(user.tenantId, id);
  if (!s) notFound();
  const isOpen = s.status === "aberto";
  // turno fechado mostra a conta como estava no acerto; estorno feito depois aparece à parte
  const cashSales = isOpen ? s.summary.dinheiro : s.expected - s.openingCashCents + s.handedOver + s.spent;
  const refundedAfter = isOpen ? 0 : cashSales - s.summary.dinheiro;
  const inRoute = s.orders.filter((o) => o.status === "em_rota").length;
  const canSettle = user.role === "dono" || user.role === "caixa";
  const pending = !isOpen && !!s.differenceCents && !s.resolvedAt;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/caixa" className="text-accent hover:underline">Caixa</Link>
        <span className="text-muted">/</span>
        <h1 className="h1">Acerto de {s.driverName}</h1>
      </div>
      <p className="-mt-4 mb-6 text-muted">
        Turno aberto em {fmtDateTime(s.openedAt)}
        {s.openedByName && ` por ${s.openedByName}`}
        {s.closedAt && `, conferido em ${fmtDateTime(s.closedAt)}`}
        {s.closedAt && s.closedByName && ` por ${s.closedByName}`}
      </p>

      <section className="panel mb-6 p-5 sm:p-7" aria-label="Conta do acerto">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <Term label="Troco inicial" cents={s.openingCashCents} />
          <Op>+</Op>
          <Term label="Vendas em dinheiro" cents={cashSales} />
          {s.handedOver > 0 && (
            <>
              <Op>−</Op>
              <Term label="Já repassou" cents={s.handedOver} />
            </>
          )}
          {s.spent > 0 && (
            <>
              <Op>−</Op>
              <Term label="Gastos autorizados" cents={s.spent} />
            </>
          )}
          <Op>=</Op>
          <Term label="Deve apresentar" cents={s.expected} strong />
        </div>
        {!isOpen && (
          <div className="mt-6 grid items-end gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-[auto_auto_auto]">
            <Term label="Contado no acerto" cents={s.countedCashCents ?? 0} />
            <Op>→</Op>
            <div>
              <p className="text-muted">Resultado</p>
              <Difference cents={s.differenceCents ?? 0} className="text-5xl" />
            </div>
          </div>
        )}
        {refundedAfter > 0 && (
          <p className="mt-5 text-sm text-warn-fg">
            Depois do acerto, {formatBRL(refundedAfter)} em vendas em dinheiro deste turno foram estornados. O acerto continua valendo como foi feito.
          </p>
        )}
        <p className="mt-5 text-sm text-muted">
          Pix {formatBRL(s.summary.pix)}, cartão {formatBRL(s.summary.cartao)} e fiado {formatBRL(s.summary.fiado)} não passam pela mão do entregador.
        </p>
      </section>

      {pending && (
        <section className="panel mb-6 border-danger/40 p-4" aria-label="Diferença pendente">
          <h2 className="h2 mb-1 text-danger">Diferença pendente</h2>
          <p className="mb-3 text-sm text-muted">
            O acerto fechou com <Difference cents={s.differenceCents ?? 0} />. A diferença sozinha não prova erro de ninguém: confira os pedidos e os
            lançamentos abaixo antes de decidir.
          </p>
          {user.role === "dono" ? (
            <ActionForm action={resolveDifferenceAction} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <input type="hidden" name="shiftId" value={s.id} />
              <div>
                <label className="label" htmlFor="resolution">O que foi feito</label>
                <select id="resolution" name="resolution" className="input" required defaultValue="">
                  <option value="" disabled>Escolha</option>
                  {Object.entries(resolutions)
                    .filter(([k]) => ((s.differenceCents ?? 0) > 0 ? k === "sobra" || k === "erro_contagem" : k !== "sobra"))
                    .map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="res-notes">Como foi resolvido</label>
                <input id="res-notes" name="notes" required minLength={3} maxLength={300} className="input" />
              </div>
              <button className="btn btn-primary">Resolver</button>
            </ActionForm>
          ) : (
            <p className="text-sm">Só o dono pode encerrar esta pendência.</p>
          )}
        </section>
      )}
      {!isOpen && s.resolvedAt && s.resolution && (
        <section className="panel mb-6 p-4">
          <h2 className="h2 mb-1">Diferença resolvida</h2>
          <p>
            {resolutions[s.resolution as keyof typeof resolutions] ?? s.resolution}. {s.resolutionNotes}
          </p>
          <p className="mt-1 text-sm text-muted">
            {s.resolvedByName}, {fmtDateTime(s.resolvedAt)}
          </p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-6">
        <section className="panel overflow-x-auto">
          <h2 className="h2 border-b border-line px-4 py-3">Pedidos do turno</h2>
          <table className="table">
            <tbody>
              {s.orders.map((o) => (
                <tr key={o.id}>
                  <td className="num text-muted"><Link href={`/pedidos/${o.id}`} className="hover:text-accent">#{o.number}</Link></td>
                  <td>{o.customerName ?? "Balcão"}</td>
                  <td>{paymentLabel[o.paymentMethod]}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="text-right"><Money cents={o.totalCents} className={o.status === "cancelado" ? "line-through text-muted" : ""} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {(s.entries.length > 0 || (isOpen && canSettle)) && (
          <section className="panel">
            <h2 className="h2 border-b border-line px-4 py-3">Repasses e gastos do turno</h2>
            {s.entries.length > 0 && (
              <ul>
                {s.entries.map((e) => (
                  <li key={e.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 ${e.voidedAt ? "text-muted" : ""}`}>
                    <div className="min-w-0">
                      <p className={e.voidedAt ? "line-through" : "font-medium"}>
                        {e.kind === "repasse" ? "Repasse ao caixa" : "Gasto autorizado"}
                        {e.note && `: ${e.note}`}
                      </p>
                      <p className="text-[13px] text-muted">
                        {fmtDateTime(e.createdAt)}, lançado por {e.by}
                        {e.voidedAt && `. Estornado: ${e.voidReason}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Money cents={e.amountCents} className={e.voidedAt ? "line-through" : "font-semibold"} />
                      {isOpen && !e.voidedAt && user.role === "dono" && (
                        <PopoverForm label="Estornar" action={voidCashEntryAction} submit="Estornar lançamento" danger>
                          <input type="hidden" name="entryId" value={e.id} />
                          <label className="label mb-0" htmlFor={`ve-${e.id}`}>Motivo</label>
                          <input id={`ve-${e.id}`} name="reason" required minLength={3} className="input" />
                        </PopoverForm>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {isOpen && canSettle && (
              <div className="grid gap-6 p-4 sm:grid-cols-2">
                <ActionForm action={cashEntryAction} className="space-y-3" reset>
                  <input type="hidden" name="shiftId" value={s.id} />
                  <input type="hidden" name="kind" value="repasse" />
                  <input type="hidden" name="category" value="" />
                  <h3 className="font-semibold">Receber repasse</h3>
                  <p className="text-[13px] text-muted">O entregador deixou parte do dinheiro no caixa antes do acerto.</p>
                  <div>
                    <label className="label" htmlFor="rep-amount">Valor recebido</label>
                    <input id="rep-amount" name="amount" inputMode="decimal" required maxLength={12} className="input num" placeholder="0,00" />
                  </div>
                  <div>
                    <label className="label" htmlFor="rep-note">Observação (opcional)</label>
                    <input id="rep-note" name="note" maxLength={160} className="input" />
                  </div>
                  <button className="btn btn-primary">Registrar repasse</button>
                </ActionForm>
                <ActionForm action={cashEntryAction} className="space-y-3" reset>
                  <input type="hidden" name="shiftId" value={s.id} />
                  <input type="hidden" name="kind" value="saida" />
                  <h3 className="font-semibold">Gasto autorizado</h3>
                  <p className="text-[13px] text-muted">Pago com o dinheiro das entregas, com comprovante. Entra nas despesas.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="out-amount">Valor</label>
                      <input id="out-amount" name="amount" inputMode="decimal" required maxLength={12} className="input num" placeholder="0,00" />
                    </div>
                    <div>
                      <label className="label" htmlFor="out-cat">Tipo</label>
                      <select id="out-cat" name="category" className="input" defaultValue="combustivel">
                        {Object.entries(expenseCategories)
                          .filter(([k]) => k !== "estorno")
                          .map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="out-note">O que foi pago</label>
                    <input id="out-note" name="note" required minLength={2} maxLength={160} className="input" placeholder="Ex.: gasolina da moto" />
                  </div>
                  <button className="btn">Registrar gasto</button>
                </ActionForm>
              </div>
            )}
          </section>
        )}
        </div>

        <div className="space-y-6">
          {isOpen ? (
            <section className="panel p-4">
              <h2 className="h2 mb-1">Fechar acerto</h2>
              {!canSettle ? (
                <p className="text-muted">O acerto é feito pelo caixa ou pelo dono, que conferem o dinheiro do entregador.</p>
              ) : inRoute > 0 ? (
                <p className="rounded-md bg-warn-soft p-3 text-warn-fg">
                  {inRoute} {inRoute === 1 ? "pedido ainda está" : "pedidos ainda estão"} em rota. Confirme a entrega ou cancele antes de fechar.
                </p>
              ) : (
                <CloseShiftForm shiftId={s.id} expectedCents={s.expected} />
              )}
            </section>
          ) : (
            s.closingNotes && (
              <section className="panel p-4">
                <h2 className="h2 mb-1">Observação do acerto</h2>
                <p>{s.closingNotes}</p>
              </section>
            )
          )}
          <section className="panel p-4">
            <h2 className="h2 mb-2">{isOpen ? "Está com o entregador" : "Devolvido à loja no acerto"}</h2>
            {isOpen ? (
              s.held.length ? (
                <ul className="space-y-1">
                  {s.held.map((h) => (
                    <li key={h.name + h.state} className="flex justify-between">
                      <span>{h.name}, {h.state === "cheio" ? "cheios" : "vazios"}</span>
                      <span className="num font-semibold">{h.qty}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Nada no momento.</p>
              )
            ) : (
              <p className="text-muted">Cheios e vazios que estavam com o entregador voltaram ao estoque da loja.</p>
            )}
            {isOpen && s.held.length > 0 && <p className="mt-3 text-sm text-muted">Ao fechar, tudo volta para o estoque da loja.</p>}
          </section>
        </div>
      </div>
    </>
  );
}

function Term({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <Money cents={cents} className={`text-4xl font-semibold tracking-[-0.035em] sm:text-5xl ${strong ? "text-accent" : ""}`} />
    </div>
  );
}

function Op({ children }: { children: string }) {
  return <span aria-hidden="true" className="hidden pb-1 text-4xl text-muted sm:block">{children}</span>;
}
