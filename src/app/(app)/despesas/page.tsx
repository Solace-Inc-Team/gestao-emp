import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { parsePeriod, todayISO } from "@/lib/period";
import { expenseCategories, listExpenses, type ExpenseCategory } from "@/domain/expenses";
import { createExpenseAction, voidExpenseAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { PopoverForm } from "@/components/popover-form";
import { Money, PageHeader } from "@/components/ui";

export const metadata = { title: "Despesas" };

const methodLabel = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão", boleto: "Boleto" } as const;
const fmtDay = (d: string) => d.split("-").reverse().join("/");

export default async function Despesas({ searchParams }: PageProps<"/despesas">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const sp = await searchParams;
  const today = todayISO();
  const { fromStr, toStr } = parsePeriod({ de: today.slice(0, 8) + "01", ...sp });
  const list = await listExpenses(user.tenantId, fromStr, toStr);
  const valid = list.filter((e) => !e.voidedAt);
  const total = valid.reduce((s, e) => s + e.amountCents, 0);
  const byCategory = Object.entries(
    valid.reduce<Record<string, number>>((acc, e) => ((acc[e.category] = (acc[e.category] ?? 0) + e.amountCents), acc), {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader title="Despesas" description="Tudo que sai do caixa da loja. Devoluções de pedidos estornados entram aqui sozinhas." />

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="de">De</label>
          <input id="de" name="de" type="date" defaultValue={fromStr} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ate">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={toStr} className="input" />
        </div>
        <button className="btn">Ver período</button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* min-w-0: a tabela larga rola dentro do quadro em vez de alargar a coluna e a página */}
        <div className="min-w-0 space-y-6">
          <section className="panel grid sm:grid-cols-[auto_1fr] sm:divide-x sm:divide-line">
            <div className="p-5 sm:pr-8">
              <p className="text-[13px] text-muted">Total no período</p>
              <Money cents={total} className="mt-1 block text-[2rem] leading-tight font-semibold tracking-[-0.03em]" />
            </div>
            <ul className="space-y-1.5 border-t border-line p-5 text-[13px] sm:border-t-0">
              {byCategory.length ? (
                byCategory.map(([cat, cents]) => (
                  <li key={cat} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-muted">{expenseCategories[cat as ExpenseCategory] ?? cat}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                      <span className="block h-full rounded-full bg-fg/70" style={{ width: `${(cents / total) * 100}%` }} />
                    </span>
                    <Money cents={cents} className="w-24 text-right" />
                  </li>
                ))
              ) : (
                <li className="text-muted">Nenhuma despesa no período.</li>
              )}
            </ul>
          </section>

          <section className="panel overflow-x-auto">
            {list.length ? (
              <table className="table min-w-[36rem]">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Despesa</th>
                    <th>Forma</th>
                    <th className="text-right">Valor</th>
                    {user.role === "dono" && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} className={e.voidedAt ? "text-muted" : ""}>
                      <td className="num whitespace-nowrap text-muted">{fmtDay(e.paidOn)}</td>
                      <td>
                        <p className={`font-medium ${e.voidedAt ? "line-through" : ""}`}>
                          {e.orderId ? <Link href={`/pedidos/${e.orderId}`} className="hover:underline">{e.description}</Link> : e.description}
                        </p>
                        <p className="text-[13px] text-muted">
                          {expenseCategories[e.category as ExpenseCategory] ?? e.category}, por {e.by}
                          {e.voidedAt && `. Cancelada: ${e.voidReason}`}
                        </p>
                      </td>
                      <td>{methodLabel[e.method]}</td>
                      <td className={`text-right font-medium ${e.voidedAt ? "line-through" : ""}`}><Money cents={e.amountCents} /></td>
                      {user.role === "dono" && (
                        <td className="text-right">
                          {!e.voidedAt && !e.orderId && (
                            <PopoverForm label="Cancelar" action={voidExpenseAction} submit="Cancelar despesa" danger>
                              <input type="hidden" name="expenseId" value={e.id} />
                              <label className="label mb-0" htmlFor={`r-${e.id}`}>Motivo</label>
                              <input id={`r-${e.id}`} name="reason" required minLength={3} className="input" />
                            </PopoverForm>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <Receipt size={28} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
                <p className="mt-3 font-medium">Nenhuma despesa no período</p>
                <p className="mt-1 text-muted">Lance combustível, compras e contas ao lado para ver o resultado do mês nos relatórios.</p>
              </div>
            )}
          </section>
        </div>

        <section className="panel p-5 lg:self-start">
          <h2 className="h2">Lançar despesa</h2>
          <ActionForm action={createExpenseAction} className="mt-4 space-y-3" reset>
            <div>
              <label className="label" htmlFor="description">Descrição</label>
              <input id="description" name="description" required maxLength={160} className="input" placeholder="Ex.: Diesel da Strada" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="amount">Valor</label>
                <input id="amount" name="amount" inputMode="decimal" required className="input num" placeholder="0,00" />
              </div>
              <div>
                <label className="label" htmlFor="paidOn">Data</label>
                <input id="paidOn" name="paidOn" type="date" required defaultValue={today} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="category">Categoria</label>
                <select id="category" name="category" className="input" defaultValue="combustivel">
                  {Object.entries(expenseCategories)
                    .filter(([k]) => k !== "estorno")
                    .map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="method">Forma</label>
                <select id="method" name="method" className="input" defaultValue="dinheiro">
                  {Object.entries(methodLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-primary w-full">Lançar despesa</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
