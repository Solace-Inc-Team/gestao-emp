import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/ctx";
import { requireUser } from "@/lib/auth";
import { getCustomer, listAddresses, listOrders } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { CustomerFields } from "@/components/customer-fields";
import { PopoverForm } from "@/components/popover-form";
import { addAddressAction, removeAddressAction, anonymizeCustomerAction, receivePaymentAction, saveCustomerAction, voidPaymentAction } from "@/app/actions";
import { customerStatement } from "@/domain/receivables";
import { centsToInput } from "@/lib/money";
import { Empty, Money, StatusBadge, fmtDateTime, paymentLabel } from "@/components/ui";

export const metadata = { title: "Cliente" };

export default async function Cliente({ params }: PageProps<"/clientes/[id]">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const c = await getCustomer(user.tenantId, id);
  if (!c) notFound();
  const [orders, st, addresses] = await Promise.all([
    listOrders(user.tenantId, { customerId: id }),
    customerStatement(user.tenantId, id),
    listAddresses(user.tenantId, [id]),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/clientes" className="text-accent hover:underline">Clientes</Link>
          <span className="text-muted">/</span>
          <h1 className="h1">{c.name}</h1>
        </div>
        {!c.anonymizedAt && <Link href={`/pedidos/novo?cliente=${c.id}`} className="btn btn-primary">Novo pedido</Link>}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          {st.entries.length > 0 && (
            <section id="receber" className="panel scroll-mt-6">
              <div className="flex items-end justify-between gap-3 border-b border-line p-4">
                <div>
                  <h2 className="h2">Fiado</h2>
                  <p className="mt-0.5 text-[13px] text-muted">{st.owed > 0 ? "Saldo devedor" : "Tudo pago"}</p>
                </div>
                <Money cents={st.owed} className={`text-2xl font-semibold tracking-[-0.03em] ${st.owed > 0 ? "text-danger" : ""}`} />
              </div>
              {st.owed > 0 && (
                <ActionForm key={st.owed} action={receivePaymentAction} className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 sm:items-end">
                  <input type="hidden" name="customerId" value={c.id} />
                  <div>
                    <label className="label" htmlFor="amount">Valor recebido</label>
                    <input id="amount" name="amount" inputMode="decimal" required defaultValue={centsToInput(st.owed)} className="input num" />
                  </div>
                  <div>
                    <label className="label" htmlFor="method">Forma</label>
                    <select id="method" name="method" className="input" defaultValue="dinheiro">
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="cartao">Cartão</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="pay-note">Observação (opcional)</label>
                    <input id="pay-note" name="note" maxLength={200} className="input" />
                  </div>
                  <button className="btn btn-primary">Registrar</button>
                </ActionForm>
              )}
              <ul>
                {st.entries.map((e) => (
                  <li key={e.id} className={`flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-0 ${e.voidedAt ? "text-muted" : ""}`}>
                    <div className="min-w-0">
                      {e.kind === "compra" ? (
                        <Link href={`/pedidos/${e.id}`} className="font-medium hover:underline">Compra #{e.number}</Link>
                      ) : (
                        <span className={`font-medium ${e.voidedAt ? "line-through" : ""}`}>Pagamento em {paymentLabel[e.method!].toLowerCase()}</span>
                      )}
                      <p className="text-muted">
                        {fmtDateTime(e.at)}
                        {e.by && `, recebido por ${e.by}`}
                        {e.note && `. ${e.note}`}
                        {e.voidedAt && `. Estornado: ${e.voidReason}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Money
                        cents={e.kind === "compra" ? e.amount : -e.amount}
                        className={e.voidedAt ? "line-through" : e.kind === "pagamento" ? "text-ok" : ""}
                      />
                      {e.kind === "pagamento" && !e.voidedAt && user.role === "dono" && (
                        <PopoverForm label="Estornar" action={voidPaymentAction} submit="Estornar pagamento" danger>
                          <input type="hidden" name="paymentId" value={e.id} />
                          <label className="label mb-0" htmlFor={`v-${e.id}`}>Motivo</label>
                          <input id={`v-${e.id}`} name="reason" required minLength={3} className="input" />
                        </PopoverForm>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {c.anonymizedAt ? (
            <section className="panel p-4">
              <h2 className="h2 mb-1">Dados apagados</h2>
              <p className="text-sm text-muted">
                Nome, contato e endereço foram apagados em {fmtDateTime(c.anonymizedAt)} a pedido do cliente. Os pedidos continuam nos relatórios.
              </p>
            </section>
          ) : (
            <>
              <section className="panel p-4">
                <h2 className="h2 mb-3">Dados</h2>
                <ActionForm action={saveCustomerAction} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={c.id} />
                  <CustomerFields c={c} />
                  <button className="btn btn-primary sm:col-span-2 sm:justify-self-start">Salvar alterações</button>
                </ActionForm>
              </section>
              <section className="panel p-4">
                <h2 className="h2 mb-1">Outros endereços de entrega</h2>
                <p className="mb-3 text-sm text-muted">Trabalho, casa da mãe, obra. No novo pedido dá para escolher onde entregar.</p>
                {addresses.length > 0 && (
                  <ul className="mb-4 divide-y divide-line rounded-md border border-line">
                    {addresses.map((a) => (
                      <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-medium">{a.label}</p>
                          <p className="text-sm text-muted">{[a.address, a.reference].filter(Boolean).join(", ")}</p>
                        </div>
                        <ActionForm action={removeAddressAction} confirm={`Remover o endereço "${a.label}"?`}>
                          <input type="hidden" name="addressId" value={a.id} />
                          <button className="tap text-[13px] text-muted hover:text-danger">Remover</button>
                        </ActionForm>
                      </li>
                    ))}
                  </ul>
                )}
                <ActionForm action={addAddressAction} className="grid gap-3 sm:grid-cols-2" reset>
                  <input type="hidden" name="customerId" value={c.id} />
                  <div>
                    <label className="label" htmlFor="addr-label">Nome do endereço</label>
                    <input id="addr-label" name="label" required minLength={2} maxLength={40} className="input" placeholder="Trabalho" />
                  </div>
                  <div>
                    <label className="label" htmlFor="addr-ref">Referência</label>
                    <input id="addr-ref" name="reference" maxLength={200} className="input" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="addr-address">Endereço</label>
                    <input id="addr-address" name="address" required minLength={5} maxLength={200} className="input" />
                  </div>
                  <button className="btn sm:justify-self-start">Adicionar endereço</button>
                </ActionForm>
              </section>
              {user.role === "dono" && (
                <section className="panel p-4">
                  <h2 className="h2 mb-1">Apagar dados pessoais</h2>
                  <p className="mb-3 text-sm text-muted">
                    Quando o cliente pedir (LGPD). Apaga nome, telefone, endereço e observações, inclusive do histórico. Os pedidos ficam, sem identificar a pessoa. Não tem volta.
                  </p>
                  <ActionForm action={anonymizeCustomerAction} confirm={`Apagar os dados pessoais de ${c.name}? Não tem volta.`}>
                    <input type="hidden" name="customerId" value={c.id} />
                    <div className="mb-3 max-w-xs">
                      <label className="label" htmlFor="anon-pw">Sua senha, para confirmar</label>
                      <input id="anon-pw" name="confirmPassword" type="password" autoComplete="current-password" required className="input" />
                    </div>
                    <button className="btn btn-danger">Apagar dados do cliente</button>
                  </ActionForm>
                </section>
              )}
            </>
          )}
        </div>
        <section className="panel">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="h2">Pedidos</h2>
          </div>
          {orders.length ? (
            <table className="table">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="num text-muted"><Link href={`/pedidos/${o.id}`} className="hover:text-accent">#{o.number}</Link></td>
                    <td>{fmtDateTime(o.createdAt)}</td>
                    <td>{paymentLabel[o.paymentMethod]}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right"><Money cents={o.totalCents} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Este cliente ainda não fez pedidos.</Empty>
          )}
        </section>
      </div>
    </>
  );
}
