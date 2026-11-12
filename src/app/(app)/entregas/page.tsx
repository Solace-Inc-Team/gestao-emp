import { ViewTransition } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { withTenant } from "@/db";
import { getSettings, listDrivers, listOrders, listShifts } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { dispatchAction } from "@/app/actions";
import { Empty, Money, PageHeader, SiteBadge, paymentLabel } from "@/components/ui";

export const metadata = { title: "Entregas" };

const minutesSince = (d: Date | null) => (d ? Math.floor((Date.now() - d.getTime()) / 60000) : 0);
// o mesmo nome na fila e na rua: quando o pedido sai, o cartão desliza de uma coluna para a outra
const Card = ({ id, children }: { id: string; children: React.ReactElement }) => (
  <ViewTransition name={`pedido-${id}`} share="morph" update="move" enter="item-in" exit="item-out" default="none">
    {children}
  </ViewTransition>
);

const waited = (min: number) =>
  min < 60 ? `${min} min` : min % 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}` : `${min / 60} h`;

export default async function Entregas() {
  const user = await requireUser("dono", "atendente", "caixa");
  const [waiting, inRoute, drivers, open, settings] = await withTenant(user.tenantId, () =>
    Promise.all([
      listOrders(user.tenantId, { status: "aberto" }),
      listOrders(user.tenantId, { status: "em_rota" }),
      listDrivers(user.tenantId),
      listShifts(user.tenantId, "aberto"),
      getSettings(user.tenantId),
    ]),
  );
  const onShift = drivers.filter((d) => open.some((s) => s.driverId === d.id));
  // mais antigo primeiro: é o próximo a sair
  const queue = [...waiting].reverse();
  const late = (o: { createdAt: Date }) => minutesSince(o.createdAt) > settings.lateAfterMinutes;
  const lateCount = [...waiting, ...inRoute].filter(late).length;

  return (
    <>
      <PageHeader
        title="Entregas"
        description={
          lateCount
            ? `${lateCount} ${lateCount === 1 ? "pedido passou" : "pedidos passaram"} de ${waited(settings.lateAfterMinutes)} desde que ${lateCount === 1 ? "foi lançado" : "foram lançados"}.`
            : "Pedidos esperando para sair e o que está na rua com cada entregador."
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <h2 className="h2 border-b border-line px-4 py-3">
            Aguardando saída <span className="font-normal text-muted">({queue.length})</span>
          </h2>
          {queue.length ? (
            <ul>
              {queue.map((o) => (
                <Card key={o.id} id={o.id}>
                  <li className={`border-b border-line px-4 py-3 last:border-0 ${minutesSince(o.createdAt) < 1 ? "row-new" : ""}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <Link href={`/pedidos/${o.id}`} className="font-semibold hover:text-accent">
                        <span className="num text-muted">#{o.number}</span> {o.customerName ?? "Cliente"}
                        {o.origin === "portal" && <SiteBadge />}
                      </Link>
                      <span className={`text-[13px] ${late(o) ? "font-semibold text-danger" : "text-muted"}`}>
                        {late(o) ? "Atrasado, " : ""}há {waited(minutesSince(o.createdAt))}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      {o.customerAddress || "Sem endereço"}. <Money cents={o.totalCents} />, {paymentLabel[o.paymentMethod].toLowerCase()}
                    </p>
                    {o.occurrence && <p className="mt-1 text-sm font-medium text-warn-fg">Voltou da rua: {o.occurrence}</p>}
                    {onShift.length > 0 && (
                      <ActionForm action={dispatchAction} className="mt-2 flex gap-2">
                        <input type="hidden" name="orderId" value={o.id} />
                        <label className="sr-only" htmlFor={`d-${o.id}`}>Entregador do pedido {o.number}</label>
                        <select id={`d-${o.id}`} name="driverId" className="input flex-1" required defaultValue={onShift.length === 1 ? onShift[0].id : ""}>
                          <option value="" disabled>Entregador</option>
                          {onShift.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <button className="btn btn-primary">Saiu para entrega</button>
                      </ActionForm>
                    )}
                  </li>
                </Card>
              ))}
            </ul>
          ) : (
            <Empty>Nenhum pedido esperando.</Empty>
          )}
          {queue.length > 0 && onShift.length === 0 && (
            <p className="border-t border-line px-4 py-3 text-sm text-muted">
              Nenhum entregador com turno aberto. <Link href="/caixa" className="text-accent underline">Abrir turno</Link>
            </p>
          )}
        </section>

        <section className="panel">
          <h2 className="h2 border-b border-line px-4 py-3">
            Na rua <span className="font-normal text-muted">({inRoute.length})</span>
          </h2>
          {onShift.length ? (
            onShift.map((d) => {
              const mine = inRoute.filter((o) => o.driverId === d.id).reverse();
              return (
                <div key={d.id} className="border-b border-line last:border-0">
                  {/* com pedidos, o nome é cabeçalho do grupo; livre, é uma linha comum: está pronto para sair */}
                  <p className={`flex justify-between px-4 text-[13px] font-medium ${mine.length ? "bg-subtle py-2" : "py-3"}`}>
                    <span>{d.name}</span>
                    {mine.length ? (
                      <span className="text-muted">{mine.length} em rota</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ok">
                        <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
                        livre
                      </span>
                    )}
                  </p>
                  {mine.map((o) => (
                    <Card key={o.id} id={o.id}>
                      <div className={`flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2.5 ${minutesSince(o.dispatchedAt) < 1 ? "row-new" : ""}`}>
                        <Link href={`/pedidos/${o.id}`} className="min-w-0 hover:text-accent">
                          <span className="num text-muted">#{o.number}</span> {o.customerName ?? "Cliente"}
                          <span className="block text-sm text-muted">{o.customerAddress}</span>
                        </Link>
                        <span className={`text-[13px] ${late(o) ? "font-semibold text-danger" : "text-muted"}`}>
                          saiu há {waited(minutesSince(o.dispatchedAt))}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })
          ) : (
            <Empty>Nenhum entregador em turno.</Empty>
          )}
        </section>
      </div>
    </>
  );
}
