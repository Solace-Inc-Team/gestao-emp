import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listDrivers, listShifts } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { openShiftAction } from "@/app/actions";
import { Difference, Empty, Money, PageHeader, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Caixa e acertos" };

export default async function Caixa() {
  const user = await requireUser("dono", "atendente", "caixa");
  const [open, closed, drivers] = await Promise.all([
    listShifts(user.tenantId, user.branchId, "aberto"),
    listShifts(user.tenantId, user.branchId, "fechado"),
    listDrivers(user.tenantId, user.branchId),
  ]);
  const free = drivers.filter((d) => !open.some((s) => s.driverId === d.id));
  const canSettle = user.role === "dono" || user.role === "caixa";

  return (
    <>
      <PageHeader title="Caixa e acertos" />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel">
          <h2 className="h2 border-b border-line px-4 py-3">Turnos abertos</h2>
          {open.length ? (
            <ul>
              {open.map((s) => (
                // mesma grade em toda linha: nome à esquerda, valor e botão à direita, sem pular de lugar por causa do texto
                <li key={s.id} className="grid gap-3 border-b border-line px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">{s.driverName}</p>
                    <p className="text-sm text-muted">
                      Desde {fmtDateTime(s.openedAt)}, {s.orderCount} {s.orderCount === 1 ? "pedido" : "pedidos"}
                      {s.inRoute ? `, ${s.inRoute} em rota` : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="sm:text-right">
                      <p className="text-sm text-muted">Deve apresentar</p>
                      <Money cents={s.expected} className="text-2xl font-semibold" />
                    </div>
                    <Link href={`/caixa/${s.id}`} className="btn btn-primary">{canSettle ? "Repasse ou acerto" : "Ver turno"}</Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nenhum entregador em turno.</Empty>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="h2 mb-1">Abrir turno</h2>
          {free.length ? (
            <ActionForm action={openShiftAction} className="space-y-3" reset>
              <div>
                <label className="label" htmlFor="driverId">Entregador</label>
                <select id="driverId" name="driverId" className="input" required defaultValue="">
                  <option value="" disabled>Escolha</option>
                  {free.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="openingCash">Troco inicial</label>
                <input id="openingCash" name="openingCash" inputMode="decimal" maxLength={12} className="input" placeholder="50,00" />
              </div>
              <button className="btn btn-primary">Abrir turno</button>
            </ActionForm>
          ) : drivers.length ? (
            <p className="text-muted">Todos os entregadores ativos já estão em turno.</p>
          ) : (
            <p className="text-muted">
              Nenhum entregador cadastrado.{" "}
              {user.role === "dono" ? <Link href="/equipe" className="text-accent underline">Cadastre em Equipe.</Link> : "Peça ao dono para cadastrar em Equipe."}
            </p>
          )}
        </section>
      </div>

      <section className="panel mt-6 overflow-x-auto">
        <h2 className="h2 border-b border-line px-4 py-3">Acertos fechados</h2>
        {closed.length ? (
          <>
          {/* no celular, o resultado do acerto na primeira linha, os valores embaixo */}
          <ul className="sm:hidden">
            {closed.map((s) => (
              <li key={s.id} className={`border-b border-line last:border-0 ${s.pending ? "bg-danger-soft/40" : ""}`}>
                <Link href={`/caixa/${s.id}`} className="block px-4 py-3 active:bg-subtle">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{s.driverName}</span>
                    <span className="shrink-0 text-right">
                      <Difference cents={s.differenceCents ?? 0} />
                      {s.pending && <span className="ml-2 rounded bg-danger-soft px-1.5 py-0.5 text-xs font-semibold text-danger">pendente</span>}
                    </span>
                  </span>
                  <span className="mt-1 block text-[13px] text-muted">
                    {fmtDateTime(s.closedAt)}, esperado <Money cents={s.expectedCashCents ?? 0} />, contado <Money cents={s.countedCashCents ?? 0} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
          <table className="table min-w-[40rem]">
            <thead>
              <tr><th>Entregador</th><th>Fechado em</th><th className="text-right">Esperado</th><th className="text-right">Contado</th><th className="text-right">Resultado</th></tr>
            </thead>
            <tbody>
              {closed.map((s) => (
                <tr key={s.id} className={s.pending ? "bg-danger-soft/40" : ""}>
                  <td><Link href={`/caixa/${s.id}`} className="font-medium hover:text-accent">{s.driverName}</Link></td>
                  <td>{fmtDateTime(s.closedAt)}</td>
                  <td className="text-right"><Money cents={s.expectedCashCents ?? 0} /></td>
                  <td className="text-right"><Money cents={s.countedCashCents ?? 0} /></td>
                  <td className="text-right">
                    <Difference cents={s.differenceCents ?? 0} />
                    {s.pending && <span className="ml-2 rounded bg-danger-soft px-1.5 py-0.5 text-xs font-semibold text-danger">pendente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        ) : (
          <Empty>Nenhum acerto fechado ainda.</Empty>
        )}
      </section>
    </>
  );
}
