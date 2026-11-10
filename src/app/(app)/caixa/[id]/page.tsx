import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/ctx";
import { requireUser } from "@/lib/auth";
import { getShift } from "@/domain/queries";
import { Difference, Money, StatusBadge, fmtDateTime, paymentLabel } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { CloseShiftForm } from "./close-form";

export const metadata = { title: "Acerto" };

export default async function Acerto({ params }: PageProps<"/caixa/[id]">) {
  const user = await requireUser("dono", "atendente");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const s = await getShift(user.tenantId, id);
  if (!s) notFound();
  const cashSales = s.summary.dinheiro;
  const isOpen = s.status === "aberto";
  const inRoute = s.orders.filter((o) => o.status === "em_rota").length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/caixa" className="text-accent hover:underline">Caixa</Link>
        <span className="text-muted">/</span>
        <h1 className="h1">Acerto de {s.driverName}</h1>
      </div>
      <p className="-mt-4 mb-6 text-muted">
        Turno aberto em {fmtDateTime(s.openedAt)}
        {s.closedAt && `, fechado em ${fmtDateTime(s.closedAt)}`}
      </p>

      <section className="panel mb-6 p-5 sm:p-7" aria-label="Conta do acerto">
        <div className="grid items-end gap-x-6 gap-y-4 sm:grid-cols-[auto_auto_auto_auto_auto]">
          <Term label="Troco inicial" cents={s.openingCashCents} />
          <Op>+</Op>
          <Term label="Vendas em dinheiro" cents={cashSales} />
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
        <p className="mt-5 text-sm text-muted">
          Pix {formatBRL(s.summary.pix)}, cartão {formatBRL(s.summary.cartao)} e fiado {formatBRL(s.summary.fiado)} não passam pela mão do entregador.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
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

        <div className="space-y-6">
          {isOpen ? (
            <section className="panel p-4">
              <h2 className="h2 mb-1">Fechar acerto</h2>
              {inRoute > 0 ? (
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
