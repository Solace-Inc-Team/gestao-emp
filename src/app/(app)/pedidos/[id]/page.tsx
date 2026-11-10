import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/ctx";
import { requireUser } from "@/lib/auth";
import { getOrder, listDrivers, listShifts } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { cancelAction, deliverAction, dispatchAction, refundOrderAction } from "@/app/actions";
import { Money, StatusBadge, fmtDateTime, paymentLabel } from "@/components/ui";

export const metadata = { title: "Pedido" };

const actionLabel: Record<string, string> = {
  "pedido.criar": "Pedido lançado",
  "pedido.saida": "Saiu para entrega",
  "pedido.entregue": "Entrega confirmada",
  "pedido.cancelar": "Pedido cancelado",
  "pedido.estornar": "Pedido estornado",
};

export default async function Pedido({ params }: PageProps<"/pedidos/[id]">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const o = await getOrder(user.tenantId, id);
  if (!o) notFound();
  const [drivers, open] = await Promise.all([listDrivers(user.tenantId), listShifts(user.tenantId, "aberto")]);
  const onShift = drivers.filter((d) => open.some((s) => s.driverId === d.id));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/pedidos" className="text-accent hover:underline">Pedidos</Link>
        <span className="text-muted">/</span>
        <h1 className="h1">Pedido #{o.number}</h1>
        <StatusBadge status={o.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="panel">
            <table className="table">
              <thead>
                <tr><th>Item</th><th className="text-right">Qtd.</th><th className="text-right">Preço</th><th className="text-right">Subtotal</th></tr>
              </thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.name}
                      {!i.returnsEmpty && <p className="text-sm text-muted">sem troca de vasilhame</p>}
                    </td>
                    <td className="num text-right">{i.quantity}</td>
                    <td className="text-right"><Money cents={i.unitPriceCents} /></td>
                    <td className="text-right"><Money cents={i.quantity * i.unitPriceCents} /></td>
                  </tr>
                ))}
                {o.deliveryFeeCents > 0 && (
                  <tr><td colSpan={3}>Taxa de entrega</td><td className="text-right"><Money cents={o.deliveryFeeCents} /></td></tr>
                )}
                <tr>
                  <td colSpan={3} className="font-semibold">Total, {paymentLabel[o.paymentMethod].toLowerCase()}</td>
                  <td className="text-right"><Money cents={o.totalCents} className="text-xl font-semibold" /></td>
                </tr>
              </tbody>
            </table>
            {(o.changeForCents || o.notes) && (
              <div className="border-t border-line px-4 py-3 text-sm">
                {o.changeForCents ? <p>Troco para <Money cents={o.changeForCents} /> (levar <Money cents={o.changeForCents - o.totalCents} />)</p> : null}
                {o.notes && <p>Obs.: {o.notes}</p>}
              </div>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="h2 mb-3">Histórico</h2>
            <ol className="space-y-2">
              {o.history.map((h, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2">
                  <span>{actionLabel[h.action] ?? h.action}{h.userName && <span className="text-muted">, por {h.userName}</span>}</span>
                  <span className="text-sm text-muted">{fmtDateTime(h.createdAt)}</span>
                </li>
              ))}
            </ol>
            {o.cancelReason && <p className="mt-3 rounded-md bg-subtle p-3 text-sm">Motivo do cancelamento: {o.cancelReason}</p>}
            {o.refundReason && <p className="mt-3 rounded-md bg-subtle p-3 text-sm">Motivo do estorno: {o.refundReason}</p>}
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel p-4">
            <h2 className="h2 mb-2">Cliente</h2>
            {o.customerName ? (
              <>
                <Link href={`/clientes/${o.customerId}`} className="font-semibold hover:text-accent">{o.customerName}</Link>
                <p>{o.customerAddress}</p>
                {o.customerReference && <p className="text-muted">{o.customerReference}</p>}
                {o.customerPhone && <p className="text-muted">{o.customerPhone}</p>}
              </>
            ) : (
              <p className="text-muted">Venda no balcão</p>
            )}
            {o.driverName && <p className="mt-3">Entregador: <b>{o.driverName}</b></p>}
          </section>

          {o.status === "aberto" && (
            <section className="panel p-4">
              <h2 className="h2 mb-3">Enviar para entrega</h2>
              {onShift.length ? (
                <ActionForm action={dispatchAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="orderId" value={o.id} />
                  <label className="sr-only" htmlFor="driverId">Entregador</label>
                  <select id="driverId" name="driverId" className="input flex-1" required defaultValue="">
                    <option value="" disabled>Escolha o entregador</option>
                    {onShift.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button className="btn btn-primary">Saiu para entrega</button>
                </ActionForm>
              ) : (
                <p className="text-muted">Nenhum entregador com turno aberto. <Link href="/caixa" className="text-accent underline">Abrir turno</Link></p>
              )}
            </section>
          )}

          {o.status === "em_rota" && (
            <section className="panel p-4">
              <h2 className="h2 mb-1">Confirmar entrega</h2>
              <p className="mb-3 text-sm text-muted">Use quando o entregador avisar por telefone. Ele também pode confirmar pelo celular.</p>
              <ActionForm action={deliverAction}>
                <input type="hidden" name="orderId" value={o.id} />
                <button className="btn btn-primary w-full">Confirmar entrega</button>
              </ActionForm>
            </section>
          )}

          {o.status === "entregue" && user.role === "dono" && (
            <section className="panel p-4">
              <h2 className="h2 mb-1">Estornar pedido</h2>
              <p className="mb-3 text-[13px] text-muted">
                {o.paymentMethod === "fiado"
                  ? "A venda sai dos números e a dívida do cliente diminui."
                  : "A venda sai dos números e a devolução do dinheiro entra nas despesas de hoje."}
              </p>
              <ActionForm action={refundOrderAction} className="space-y-3" confirm="Estornar este pedido? Não dá para desfazer.">
                <input type="hidden" name="orderId" value={o.id} />
                <div>
                  <label className="label" htmlFor="refund-reason">Motivo</label>
                  <input id="refund-reason" name="reason" required minLength={3} className="input" />
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" name="restock" defaultChecked />
                  Os produtos voltaram para a loja
                </label>
                <button className="btn btn-danger">Estornar pedido</button>
              </ActionForm>
            </section>
          )}

          {(o.status === "aberto" || o.status === "em_rota") && (
            <section className="panel p-4">
              <h2 className="h2 mb-1">Cancelar pedido</h2>
              {o.status === "em_rota" && <p className="mb-2 text-sm text-muted">Os produtos voltam do entregador para a loja.</p>}
              <ActionForm action={cancelAction} className="space-y-2" confirm="Cancelar este pedido?">
                <input type="hidden" name="orderId" value={o.id} />
                <label className="label" htmlFor="reason">Motivo</label>
                <input id="reason" name="reason" required minLength={3} className="input" />
                <button className="btn btn-danger">Cancelar pedido</button>
              </ActionForm>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
