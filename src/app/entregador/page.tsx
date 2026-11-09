import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getShift, itemsForOrders, listOrders, openShiftFor, getOrder } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { deliverAction, logout } from "@/app/actions";
import { Logo } from "@/components/logo";
import { Money, paymentLabel } from "@/components/ui";

export const metadata = { title: "Minhas entregas" };

export default async function Entregador() {
  const user = await requireUser("entregador");
  const shift = await openShiftFor(user.tenantId, user.userId);
  const s = shift ? await getShift(user.tenantId, shift.id) : null;
  const route = shift ? await listOrders(user.tenantId, { status: "em_rota", driverId: user.userId }) : [];
  const details = await Promise.all(route.map((o) => getOrder(user.tenantId, o.id)));
  const items = await itemsForOrders(user.tenantId, route.map((o) => o.id));
  const done = s ? s.orders.filter((o) => o.status === "entregue") : [];

  return (
    <div className="mx-auto min-h-screen max-w-lg">
      <header className="flex items-center justify-between bg-ink px-4 py-3 text-white">
        <Logo light />
        <div className="flex gap-4 text-sm">
          <Link href="/senha" className="text-white/80 underline">Senha</Link>
          <form action={logout}>
            <button className="text-white/80 underline">Sair</button>
          </form>
        </div>
      </header>

      <div className="px-4 py-5">
        <p className="text-ink-soft">Olá, {user.name.split(" ")[0]}</p>
        {!s ? (
          <div className="panel mt-4 p-5">
            <h1 className="h2">Sem turno aberto</h1>
            <p className="mt-1 text-ink-soft">Peça para a loja abrir seu turno antes de sair com mercadoria.</p>
          </div>
        ) : (
          <>
            <section className="mt-3 rounded-lg bg-water p-5 text-white" aria-label="Seu caixa">
              <p className="text-white/80">Dinheiro que você deve ter agora</p>
              <Money cents={s.expected} className="text-5xl font-semibold" />
              <p className="mt-1 text-sm text-white/80">
                Troco inicial <Money cents={s.openingCashCents} /> + vendas em dinheiro <Money cents={s.summary.dinheiro} />
              </p>
            </section>

            <h1 className="h2 mt-6 mb-3">
              {route.length ? `${route.length} ${route.length === 1 ? "entrega" : "entregas"} para fazer` : "Nenhuma entrega pendente"}
            </h1>
            <ul className="space-y-4">
              {details.map((o) =>
                o ? (
                  <li key={o.id} className="panel overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-lg font-semibold">{o.customerName ?? "Cliente"}</p>
                        <span className="num text-ink-soft">#{o.number}</span>
                      </div>
                      {o.customerAddress && (
                        <a
                          className="mt-1 block text-water underline"
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.customerAddress)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {o.customerAddress}
                        </a>
                      )}
                      {o.customerReference && <p className="text-ink-soft">{o.customerReference}</p>}
                      {o.customerPhone && (
                        <a href={`tel:${o.customerPhone.replace(/[^\d+]/g, "")}`} className="mt-1 inline-block text-water underline">
                          Ligar: {o.customerPhone}
                        </a>
                      )}
                      <ul className="mt-3 space-y-0.5">
                        {items.filter((i) => i.orderId === o.id).map((i, k) => (
                          <li key={k}>
                            <b className="num">{i.quantity}×</b> {i.name}
                            {i.returnsEmpty ? <span className="text-ink-soft">, recolher vazio</span> : <span className="text-gas">, sem troca</span>}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-paper px-3 py-2">
                        <span>Cobrar em {paymentLabel[o.paymentMethod].toLowerCase()}</span>
                        <Money cents={o.totalCents} className="text-2xl font-semibold" />
                      </div>
                      {o.changeForCents ? (
                        <p className="mt-2 font-semibold text-[#7a5200]">
                          Levar troco: <Money cents={o.changeForCents - o.totalCents} /> (cliente paga com <Money cents={o.changeForCents} />)
                        </p>
                      ) : null}
                      {o.notes && <p className="mt-2 text-sm">Obs.: {o.notes}</p>}
                    </div>
                    <ActionForm action={deliverAction} className="border-t border-line p-3">
                      <input type="hidden" name="orderId" value={o.id} />
                      <button className="btn btn-primary h-14 w-full text-lg">
                        {o.paymentMethod === "fiado" ? "Entreguei (fiado)" : "Entreguei e recebi"}
                      </button>
                    </ActionForm>
                  </li>
                ) : null,
              )}
            </ul>

            {done.length > 0 && (
              <section className="mt-8">
                <h2 className="h2 mb-2">Entregues neste turno</h2>
                <ul className="panel">
                  {done.map((o) => (
                    <li key={o.id} className="flex justify-between border-b border-line px-4 py-2.5 last:border-0">
                      <span>#{o.number} {o.customerName}, {paymentLabel[o.paymentMethod].toLowerCase()}</span>
                      <Money cents={o.totalCents} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
