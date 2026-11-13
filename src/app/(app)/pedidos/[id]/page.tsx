import { Revelar } from "@/components/revelar";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/ctx";
import { requireUser } from "@/lib/auth";
import { getOrder, getSettings, listDrivers, listShifts } from "@/domain/queries";
import { orderPix } from "@/domain/portal";
import { PixBox } from "@/components/pix-box";
import { ActionForm } from "@/components/action-form";
import { cancelAction, confirmPixAction, deliverAction, dispatchAction, reassignAction, refundOrderAction } from "@/app/actions";
import { DeliveryExceptions } from "@/components/delivery-forms";
import { originLabel } from "@/domain/orders";
import { Money, StatusBadge, fmtDateTime, paymentLabel } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { headers } from "next/headers";
import { MessageCircle } from "lucide-react";

export const metadata = { title: "Pedido" };

const actionLabel: Record<string, string> = {
  "pedido.criar": "Pedido lançado",
  "pedido.saida": "Saiu para entrega",
  "pedido.entregue": "Entrega confirmada",
  "pedido.entrega_parcial": "Entrega parcial registrada",
  "pedido.ocorrencia": "Entrega não realizada, voltou para a fila",
  "pedido.trocar_entregador": "Trocou de entregador",
  "pedido.pix_conferido": "Pix conferido no extrato",
  "pedido.cancelar": "Pedido cancelado",
  "pedido.estornar": "Pedido estornado",
};

export default async function Pedido({ params }: PageProps<"/pedidos/[id]">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const o = await getOrder(user.tenantId, id);
  if (!o) notFound();
  const [drivers, open, settings] = await Promise.all([listDrivers(user.tenantId), listShifts(user.tenantId, "aberto"), getSettings(user.tenantId)]);
  const pixOpen = o.paymentMethod === "pix" && !o.pixConfirmedAt && ["aberto", "em_rota", "entregue"].includes(o.status);
  const pixCode = pixOpen ? orderPix(settings, { number: o.number, totalCents: o.totalCents - o.cashPartCents }) : null;
  const onShift = drivers.filter((d) => open.some((s) => s.driverId === d.id));
  const driverName = (id?: string) => drivers.find((d) => d.id === id)?.name ?? "outro entregador";
  // link de acompanhamento só para entrega que ainda vai acontecer (balcão e cancelado não têm o que acompanhar)
  const h = await headers();
  const acompanhar =
    o.customerName && ["aberto", "em_rota"].includes(o.status)
      ? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/pedir/${settings.slug}/acompanhar/${o.trackingId}`
      : null;
  const fone = o.customerPhone?.replace(/D/g, "") ?? "";
  const zap =
    acompanhar && fone.length >= 10
      ? `https://wa.me/${fone.length <= 11 ? "55" + fone : fone}?text=${encodeURIComponent(`Seu pedido #${o.number} na ${user.tenantName}: acompanhe aqui ${acompanhar}`)}`
      : null;
  // estorno de venda em dinheiro precisa do acerto do turno feito antes
  const refundBlocked = (o.paymentMethod === "dinheiro" || o.cashPartCents > 0) && open.some((s) => s.id === o.shiftId);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/pedidos" className="alvo text-accent hover:underline">Pedidos</Link>
        <span className="text-muted">/</span>
        <h1 className="h1">Pedido #{o.number}</h1>
        <StatusBadge status={o.status} />
      </div>

      {o.status === "aberto" && o.occurrence && (
        <p className="mb-6 rounded-md border border-warn/40 bg-warn-soft px-4 py-3 text-warn-fg">
          <b>Tentativa de entrega sem sucesso</b> ({fmtDateTime(o.occurrenceAt)}): {o.occurrence}. Combine com o cliente e envie de novo.
        </p>
      )}

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
                      {!i.returnsEmpty && <p className="text-sm text-muted">{i.loan ? "vasilhame emprestado (comodato)" : "sem troca de vasilhame"}</p>}
                    </td>
                    <td className="num text-right">
                      {i.deliveredQuantity !== null && i.deliveredQuantity !== i.quantity ? (
                        <>
                          {i.deliveredQuantity} <span className="text-muted line-through">{i.quantity}</span>
                        </>
                      ) : (
                        i.quantity
                      )}
                    </td>
                    <td className="text-right"><Money cents={i.unitPriceCents} /></td>
                    <td className="text-right"><Money cents={(i.deliveredQuantity ?? i.quantity) * i.unitPriceCents} /></td>
                  </tr>
                ))}
                {o.deliveryFeeCents > 0 && (
                  <tr><td colSpan={3}>Taxa de entrega</td><td className="text-right"><Money cents={o.deliveryFeeCents} /></td></tr>
                )}
                {o.discountCents > 0 && (
                  <tr>
                    <td colSpan={3}>Desconto{o.discountReason && <span className="text-muted">: {o.discountReason}</span>}</td>
                    <td className="text-right">−<Money cents={o.discountCents} /></td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3} className="font-semibold">
                    Total, {paymentLabel[o.paymentMethod].toLowerCase()}
                    {o.cashPartCents > 0 && (
                      <span className="font-normal text-muted">
                        {" "}(<Money cents={o.cashPartCents} /> em dinheiro e <Money cents={o.totalCents - o.cashPartCents} /> no {paymentLabel[o.paymentMethod].toLowerCase()})
                      </span>
                    )}
                  </td>
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
            <ol className="trilho">
              {o.history.map((h, i) => (
                // no celular a data vai sempre para baixo; no computador, sempre à direita
                <li key={i} style={{ "--i": i } as React.CSSProperties} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                  <span>
                    {h.action === "pedido.criar" && o.origin === "portal" ? (
                      "Pedido feito pelo cliente no site"
                    ) : h.action === "pedido.trocar_entregador" ? (
                      <>
                        Trocou de entregador: de {driverName((h.data as { from?: string })?.from)} para {driverName((h.data as { to?: string })?.to)}
                        {h.userName && <span className="text-muted">, por {h.userName}</span>}
                      </>
                    ) : (
                      <>
                        {actionLabel[h.action] ?? h.action}
                        {h.userName && <span className="text-muted">, por {h.userName}</span>}
                      </>
                    )}
                  </span>
                  <span className="shrink-0 text-sm whitespace-nowrap text-muted">{fmtDateTime(h.createdAt)}</span>
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
            <p className="mt-3 text-sm text-muted">Chegou por {originLabel[o.origin as keyof typeof originLabel] ?? o.origin}</p>
            {o.driverName && <p className="mt-1">Entregador: <b>{o.driverName}</b></p>}
            {/* pedido feito por telefone ou WhatsApp também ganha o link: a loja manda e o cliente acompanha */}
            {acompanhar && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm text-muted">Link para o cliente acompanhar a entrega</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyButton text={acompanhar} label="Copiar link" />
                  {zap && (
                    <a href={zap} target="_blank" rel="noopener noreferrer" className="btn">
                      <MessageCircle size={15} strokeWidth={1.75} aria-hidden="true" /> Mandar no WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>

          {pixOpen && (
            <section className="panel p-4">
              <h2 className="h2 mb-1">Pix a conferir</h2>
              <p className="mb-3 text-sm text-muted">
                O pedido só conta como pago depois que alguém vê o valor no extrato. Comprovante enviado pelo cliente não basta.
              </p>
              {pixCode && <div className="mb-4"><PixBox code={pixCode} size={144} /></div>}
              {(user.role === "dono" || user.role === "caixa") && (
                <ActionForm action={confirmPixAction}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <button className="btn btn-primary w-full">Pix conferido no extrato</button>
                </ActionForm>
              )}
            </section>
          )}
          {o.paymentMethod === "pix" && o.pixConfirmedAt && (
            <p className="rounded-md bg-ok-soft px-4 py-3 text-sm text-ok">Pix conferido em {fmtDateTime(o.pixConfirmedAt)}.</p>
          )}

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
              <div className="mt-3">
                <DeliveryExceptions order={o} items={o.items} />
              </div>
            </section>
          )}

          {o.status === "em_rota" && onShift.some((d) => d.id !== o.driverId) && (
            <section className="panel p-4">
              <h2 className="h2 mb-1">Trocar de entregador</h2>
              <p className="mb-3 text-sm text-muted">Os produtos do pedido passam para a conta do outro entregador.</p>
              <ActionForm action={reassignAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="orderId" value={o.id} />
                <label className="sr-only" htmlFor="newDriver">Novo entregador</label>
                <select id="newDriver" name="driverId" className="input flex-1" required defaultValue="">
                  <option value="" disabled>Escolha o entregador</option>
                  {onShift.filter((d) => d.id !== o.driverId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button className="btn">Passar pedido</button>
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
              {refundBlocked ? (
                <p className="rounded-md bg-warn-soft p-3 text-sm text-warn-fg">
                  O turno do entregador deste pedido ainda está aberto. <Link href={`/caixa/${o.shiftId}`} className="underline">Faça o acerto</Link> antes de estornar.
                </p>
              ) : (
              <Revelar label="Estornar pedido" perigo>
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
                  <div>
                    <label className="label" htmlFor="refund-pw">Sua senha, para confirmar</label>
                    <input id="refund-pw" name="confirmPassword" type="password" autoComplete="current-password" required className="input" />
                  </div>
                  <button className="btn btn-danger">Estornar pedido</button>
                </ActionForm>
              </Revelar>
              )}
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
