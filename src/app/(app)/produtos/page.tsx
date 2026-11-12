import { requireUser } from "@/lib/auth";
import { listProducts } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { saveProductAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { centsToInput } from "@/lib/money";

export const metadata = { title: "Produtos e preços" };

type P = { id?: string; name?: string; priceCents?: number; containerPriceCents?: number; returnable?: boolean; minStock?: number; active?: boolean };

// no computador as linhas se alinham em colunas: o rótulo aparece só na primeira, as outras o têm para leitor de tela
function Fields({ p = {}, rotulos = true }: { p?: P; rotulos?: boolean }) {
  const k = p.id ?? "novo";
  const rotulo = rotulos ? "label" : "label lg:sr-only";
  return (
    <>
      <div className="min-w-48 flex-[2]">
        <label className={rotulo} htmlFor={`n-${k}`}>Nome</label>
        <input id={`n-${k}`} name="name" required defaultValue={p.name} className="input" />
      </div>
      <div className="w-32">
        <label className={rotulo} htmlFor={`p-${k}`}>Preço</label>
        <input id={`p-${k}`} name="price" required inputMode="decimal" defaultValue={p.priceCents !== undefined ? centsToInput(p.priceCents) : ""} className="input" />
      </div>
      <div className="w-32">
        <label className={rotulo} htmlFor={`c-${k}`}>Preço do vasilhame</label>
        <input id={`c-${k}`} name="containerPrice" inputMode="decimal" maxLength={12} defaultValue={p.containerPriceCents ? centsToInput(p.containerPriceCents) : ""} className="input" placeholder="0,00" />
      </div>
      <div className="w-28">
        <label className={rotulo} htmlFor={`m-${k}`}>Estoque mínimo</label>
        <input id={`m-${k}`} name="minStock" type="number" min={0} defaultValue={p.minStock ?? 0} className="input" />
      </div>
      <label className="flex min-h-11 items-center gap-2">
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
        O valor do vasilhame é somado quando o cliente não tem um vazio para trocar; em produto não retornável ele é ignorado.
      </p>
      <section className="panel mb-6">
        {products.map((p, i) => (
          <ActionForm key={p.id} action={saveProductAction} className={`flex flex-wrap items-end gap-3 border-b border-line p-4 last:border-0 ${p.active ? "" : "opacity-60"}`}>
            <input type="hidden" name="id" value={p.id} />
            <Fields p={p} rotulos={i === 0} />
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
