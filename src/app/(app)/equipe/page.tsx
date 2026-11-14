import { requireUser } from "@/lib/auth";
import { listUsers } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { createUserAction, mudarDeFilialAction, resetUserPasswordAction, toggleUserAction } from "@/app/actions";
import { PopoverForm } from "@/components/popover-form";
import { PageHeader, roleLabel } from "@/components/ui";
import { AcessoCampos } from "./acesso-campos";
import { semAcesso } from "@/domain/registry";

export const metadata = { title: "Equipe" };

export default async function Equipe() {
  const user = await requireUser("dono");
  const team = await listUsers(user.tenantId);
  // com uma filial só, nada de filial aparece
  const filiais = user.branches;
  const varias = filiais.length > 1;
  return (
    <>
      <PageHeader title="Equipe" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel overflow-x-auto">
          {/* no celular cada pessoa vira um bloco: nome e perfil em cima, as ações embaixo */}
          <table className="table tabela-pilha">
            <thead><tr><th>Nome</th><th>Perfil</th><th></th></tr></thead>
            <tbody>
              {team.map((u) => (
                <tr key={u.id} className={u.active ? "" : "text-muted"}>
                  <td>
                    {/* "ativo" é o normal; só quem saiu ganha a marca, e a tabela sobra espaço para as ações */}
                    <p className="font-medium">
                      {u.name}
                      {!u.active && <span className="ml-2 rounded bg-subtle px-1.5 py-0.5 text-xs font-medium text-muted">desativado</span>}
                    </p>
                    <p className="text-sm text-muted">{semAcesso(u.email) ? "Sem celular: não entra no sistema" : u.email}</p>
                  </td>
                  <td>
                    {roleLabel[u.role]}
                    {varias && <p className="text-sm whitespace-nowrap text-muted">{u.role === "dono" ? "Todas as filiais" : u.branchName}</p>}
                  </td>
                  <td className="text-right">
                    {u.id !== user.userId && (
                      <div className="flex items-center justify-start gap-3 sm:justify-end">
                        {varias && u.role !== "dono" && u.active && (
                          <PopoverForm label="Mudar de filial" action={mudarDeFilialAction} submit="Salvar">
                            <input type="hidden" name="userId" value={u.id} />
                            <label className="label mb-0" htmlFor={`f-${u.id}`}>Filial</label>
                            <select id={`f-${u.id}`} name="branchId" defaultValue={u.branchId ?? undefined} className="input">
                              {filiais.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                          </PopoverForm>
                        )}
                        {!semAcesso(u.email) && (
                        <PopoverForm label="Redefinir senha" action={resetUserPasswordAction} submit="Salvar senha nova">
                          <input type="hidden" name="userId" value={u.id} />
                          <label className="label mb-0" htmlFor={`p-${u.id}`}>Senha nova</label>
                          <input id={`p-${u.id}`} name="password" type="text" minLength={8} required autoComplete="off" className="input" />
                        </PopoverForm>
                        )}
                        <ActionForm action={toggleUserAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="active" value={String(!u.active)} />
                          <button className={`btn ${u.active ? "btn-danger" : ""}`}>{u.active ? "Desativar" : "Reativar"}</button>
                        </ActionForm>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel p-4">
          <h2 className="h2 mb-1">Adicionar pessoa</h2>
          <p className="mb-3 text-sm text-muted">Entregadores veem só os próprios pedidos no celular, ou trabalham sem celular pela folha da rota. Atendentes não alteram preços nem estoque por ajuste.</p>
          <ActionForm action={createUserAction} className="space-y-3" reset>
            <div>
              <label className="label" htmlFor="u-name">Nome</label>
              <input id="u-name" name="name" required className="input" />
            </div>
            <AcessoCampos />
            {varias && (
              <div>
                <label className="label" htmlFor="u-filial">Filial</label>
                <select id="u-filial" name="branchId" className="input" defaultValue={user.branchId}>
                  {filiais.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <p className="mt-1 text-[13px] text-muted">Quem é dono vê todas as filiais.</p>
              </div>
            )}
            <button className="btn btn-primary">Adicionar</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
