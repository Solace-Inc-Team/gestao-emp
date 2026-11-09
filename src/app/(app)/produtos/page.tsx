import { requireUser } from "@/lib/auth";
import { listProducts } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { saveProductAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { centsToInput } from "@/lib/money";

export const metadata = { title: "Produtos e preços" };

type P = { id?: string; name?: string; priceCents?: number; returnable?: boolean; minStock?: number; active?: boolean };

function Fields({ p = {} }: { p?: P }) {
  const k = p.id ?? "novo";
  return (
    <>
      <div className="min-w-48 flex-[2]">
        <label className="label" htmlFor={`n-${k}`}>Nome</label>
        <input id={`n-${k}`} name="name" required defaultValue={p.name} className="input" />
      </div>
      <div className="w-32">
        <label className="label" htmlFor={`p-${k}`}>Preço</label>
        <input id={`p-${k}`} name="price" required inputMode="decimal" defaultValue={p.priceCents !== undefined ? centsToInput(p.priceCents) : ""} className="input" />
      </div>
      <div className="w-28">
        <label className="label" htmlFor={`m-${k}`}>Mínimo</label>
        <input id={`m-${k}`} name="minStock" type="number" min={0} defaultValue={p.minStock ?? 0} className="input" />
      </div>
      <label className="flex min-h-10 items-center gap-2">
        <input type="checkbox" name="returnable" defaultChecked={p.returnable ?? true} /> Retornável
      </label>
    </>
  );
}

export default async function Produtos() {
  const user = await requireUser("dono");
  const products = await listProducts(user.tenantId);
  return (
    <>
      <PageHeader title="Produtos e preços" />
      <p className="-mt-3 mb-6 max-w-2xl text-muted">
        Mudar o preço vale para os próximos pedidos. Pedidos já lançados guardam o preço da época, e toda alteração fica registrada.
      </p>
      <section className="panel mb-6">
        {products.map((p) => (
          <ActionForm key={p.id} action={saveProductAction} className={`flex flex-wrap items-end gap-3 border-b border-line p-4 last:border-0 ${p.active ? "" : "opacity-60"}`}>
            <input type="hidden" name="id" value={p.id} />
            <Fields p={p} />
            <label className="flex min-h-10 items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={p.active} /> À venda
            </label>
            <button className="btn">Salvar</button>
          </ActionForm>
        ))}
      </section>
      <section className="panel p-4">
        <h2 className="h2 mb-3">Novo produto</h2>
        <ActionForm action={saveProductAction} className="flex flex-wrap items-end gap-3" reset>
          <Fields />
          <button className="btn btn-primary">Cadastrar produto</button>
        </ActionForm>
      </section>
    </>
  );
}
