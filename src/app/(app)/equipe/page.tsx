import { requireUser } from "@/lib/auth";
import { listUsers } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { createUserAction, resetUserPasswordAction, toggleUserAction } from "@/app/actions";
import { PopoverForm } from "@/components/popover-form";
import { PageHeader, roleLabel } from "@/components/ui";

export const metadata = { title: "Equipe" };

export default async function Equipe() {
  const user = await requireUser("dono");
  const team = await listUsers(user.tenantId);
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
                    <p className="text-sm text-muted">{u.email}</p>
                  </td>
                  <td>{roleLabel[u.role]}</td>
                  <td className="text-right">
                    {u.id !== user.userId && (
                      <div className="flex items-center justify-start gap-3 sm:justify-end">
                        <PopoverForm label="Redefinir senha" action={resetUserPasswordAction} submit="Salvar senha nova">
                          <input type="hidden" name="userId" value={u.id} />
                          <label className="label mb-0" htmlFor={`p-${u.id}`}>Senha nova</label>
                          <input id={`p-${u.id}`} name="password" type="text" minLength={8} required autoComplete="off" className="input" />
                        </PopoverForm>
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
          <p className="mb-3 text-sm text-muted">Entregadores veem só os próprios pedidos no celular. Atendentes não alteram preços nem estoque por ajuste.</p>
          <ActionForm action={createUserAction} className="space-y-3" reset>
            <div>
              <label className="label" htmlFor="u-name">Nome</label>
              <input id="u-name" name="name" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="u-email">E-mail de acesso</label>
              <input id="u-email" name="email" type="email" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="u-pass">Senha inicial</label>
              <input id="u-pass" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="u-role">Perfil</label>
              <select id="u-role" name="role" className="input" defaultValue="entregador">
                <option value="entregador">Entregador</option>
                <option value="atendente">Atendente</option>
                <option value="caixa">Caixa (faz os acertos)</option>
                <option value="dono">Dono</option>
              </select>
            </div>
            <button className="btn btn-primary">Adicionar</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
