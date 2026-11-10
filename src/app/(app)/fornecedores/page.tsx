import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listSuppliers } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { saveSupplierAction } from "@/app/actions";
import { Empty } from "@/components/ui";

export const metadata = { title: "Fornecedores" };

type S = { id?: string; name?: string; phone?: string; notes?: string };

function Fields({ s = {} }: { s?: S }) {
  const k = s.id ?? "novo";
  return (
    <>
      <div className="min-w-48 flex-[2]">
        <label className="label" htmlFor={`sn-${k}`}>Nome</label>
        <input id={`sn-${k}`} name="name" required minLength={2} maxLength={120} defaultValue={s.name} className="input" />
      </div>
      <div className="w-44">
        <label className="label" htmlFor={`sp-${k}`}>Telefone</label>
        <input id={`sp-${k}`} name="phone" inputMode="tel" maxLength={30} defaultValue={s.phone} className="input" />
      </div>
      <div className="min-w-48 flex-[2]">
        <label className="label" htmlFor={`so-${k}`}>Observações</label>
        <input id={`so-${k}`} name="notes" maxLength={300} defaultValue={s.notes} className="input" placeholder="Dia de entrega, vendedor, prazo" />
      </div>
    </>
  );
}

export default async function Fornecedores() {
  const user = await requireUser("dono", "atendente", "caixa");
  const suppliers = await listSuppliers(user.tenantId);
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <Link href="/estoque" className="text-accent hover:underline">Estoque</Link>
        <span className="text-muted">/</span>
        <h1 className="h1">Fornecedores</h1>
      </div>
      <p className="mb-6 max-w-2xl text-muted">De quem a empresa compra gás, água e acessórios. O fornecedor aparece na entrada de compra do estoque.</p>
      <section className="panel mb-6">
        {suppliers.length ? (
          suppliers.map((s) => (
            <ActionForm key={s.id} action={saveSupplierAction} className={`flex flex-wrap items-end gap-3 border-b border-line p-4 last:border-0 ${s.active ? "" : "opacity-60"}`}>
              <input type="hidden" name="id" value={s.id} />
              <Fields s={s} />
              <label className="flex min-h-10 items-center gap-2">
                <input type="checkbox" name="active" defaultChecked={s.active} /> Ativo
              </label>
              <button className="btn">Salvar</button>
            </ActionForm>
          ))
        ) : (
          <Empty>Nenhum fornecedor cadastrado.</Empty>
        )}
      </section>
      <section className="panel p-4">
        <h2 className="h2 mb-3">Novo fornecedor</h2>
        <ActionForm action={saveSupplierAction} className="flex flex-wrap items-end gap-3" reset>
          <Fields />
          <button className="btn btn-primary">Cadastrar fornecedor</button>
        </ActionForm>
      </section>
    </>
  );
}
