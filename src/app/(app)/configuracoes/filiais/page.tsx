import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { ativarFilialAction, criarFilialAction } from "@/app/actions";
import { listFiliais } from "@/domain/filiais";
import { PageHeader } from "@/components/ui";
import { ConfigNav } from "@/components/config-nav";

export const metadata = { title: "Filiais" };

export default async function Filiais() {
  const user = await requireUser("dono");
  const filiais = await listFiliais(user.tenantId);
  return (
    <>
      <ConfigNav />
      <PageHeader title="Filiais" description="Cada filial tem o próprio estoque, equipe e caixa. Clientes, produtos e preços valem para todas." />
      <section className="panel max-w-xl">
        <ul>
          {filiais.map((b) => (
            <li key={b.id} className={`flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 ${b.active ? "" : "text-muted"}`}>
              <div className="min-w-0">
                <p className="font-medium">
                  {b.name}
                  {b.main && <span className="ml-2 rounded bg-subtle px-1.5 py-0.5 text-xs font-medium text-muted">principal</span>}
                  {!b.active && <span className="ml-2 rounded bg-subtle px-1.5 py-0.5 text-xs font-medium text-muted">desativada</span>}
                </p>
                <p className="text-[13px] text-muted">{b.equipe === 1 ? "1 pessoa na equipe" : `${b.equipe} pessoas na equipe`}</p>
              </div>
              {!b.main && (
                <ActionForm action={ativarFilialAction} confirm={b.active ? `Desativar a filial ${b.name}? O histórico continua guardado.` : undefined}>
                  <input type="hidden" name="branchId" value={b.id} />
                  <input type="hidden" name="active" value={String(!b.active)} />
                  <button className="tap text-[13px] text-muted hover:text-fg">{b.active ? "Desativar" : "Reativar"}</button>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
        <ActionForm action={criarFilialAction} className="flex flex-wrap items-end gap-3 p-4" reset>
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="filial-nome">Nova filial</label>
            <input id="filial-nome" name="name" required minLength={2} maxLength={60} className="input" placeholder="Ex.: Centro" />
          </div>
          <button className="btn">Criar filial</button>
        </ActionForm>
      </section>
    </>
  );
}
