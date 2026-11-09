import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCustomer, listOrders } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { CustomerFields } from "@/components/customer-fields";
import { saveCustomerAction } from "@/app/actions";
import { Empty, Money, StatusBadge, fmtDateTime, paymentLabel } from "@/components/ui";

export const metadata = { title: "Cliente" };

export default async function Cliente({ params }: PageProps<"/clientes/[id]">) {
  const user = await requireUser("dono", "atendente");
  const { id } = await params;
  const c = await getCustomer(user.tenantId, id);
  if (!c) notFound();
  const orders = await listOrders(user.tenantId, { customerId: id });
  const owed = orders.filter((o) => o.paymentMethod === "fiado" && o.status === "entregue").reduce((s, o) => s + o.totalCents, 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/clientes" className="text-accent hover:underline">Clientes</Link>
          <span className="text-muted">/</span>
          <h1 className="h1">{c.name}</h1>
        </div>
        <Link href={`/pedidos/novo?cliente=${c.id}`} className="btn btn-primary">Novo pedido</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="panel p-4">
          <h2 className="h2 mb-3">Dados</h2>
          <ActionForm action={saveCustomerAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={c.id} />
            <CustomerFields c={c} />
            <button className="btn btn-primary sm:col-span-2 sm:justify-self-start">Salvar alterações</button>
          </ActionForm>
        </section>
        <section className="panel">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="h2">Pedidos</h2>
            {owed > 0 && <p>Total em fiado: <Money cents={owed} className="font-semibold text-danger" /></p>}
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
