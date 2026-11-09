import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listCustomers } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { CustomerFields } from "@/components/customer-fields";
import { saveCustomerAction } from "@/app/actions";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Clientes" };

export default async function Clientes({ searchParams }: PageProps<"/clientes">) {
  const user = await requireUser("dono", "atendente");
  const { q } = await searchParams;
  const term = typeof q === "string" ? q : "";
  const customers = await listCustomers(user.tenantId, term);

  return (
    <>
      <PageHeader title="Clientes" />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel">
          <form className="flex gap-2 border-b border-line p-3" role="search">
            <label htmlFor="q" className="sr-only">Buscar cliente</label>
            <input id="q" name="q" defaultValue={term} placeholder="Nome, telefone ou endereço" className="input" />
            <button className="btn">Buscar</button>
          </form>
          {customers.length ? (
            <ul>
              {customers.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <Link href={`/clientes/${c.id}`} className="font-medium hover:text-water">{c.name}</Link>
                    <p className="truncate text-sm text-ink-soft">{[c.address, c.phone].filter(Boolean).join(", ")}</p>
                  </div>
                  <Link href={`/pedidos/novo?cliente=${c.id}`} className="btn shrink-0">Novo pedido</Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{term ? `Nenhum cliente encontrado para "${term}".` : "Nenhum cliente cadastrado."}</Empty>
          )}
        </section>
        <section className="panel p-4">
          <h2 className="h2 mb-3">Cadastrar cliente</h2>
          <ActionForm action={saveCustomerAction} className="grid gap-3 sm:grid-cols-2" reset>
            <CustomerFields />
            <button className="btn btn-primary sm:col-span-2 sm:justify-self-start">Cadastrar cliente</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
