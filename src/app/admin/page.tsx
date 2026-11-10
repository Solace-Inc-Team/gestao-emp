import { requireAdmin } from "@/lib/auth";
import { DELETE_DEADLINE_DAYS, listDeletions, listTenants } from "@/domain/platform";
import { ActionForm } from "@/components/action-form";
import { createTenantAction, deleteTenantAction, resetOwnerAccessAction, toggleTenantAction } from "@/app/actions";
import { PopoverForm } from "@/components/popover-form";
import { Empty, PageHeader, fmtDateTime } from "@/components/ui";

const daysAgo = (d: string | Date | null) => {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
};

export default async function Admin() {
  const admin = await requireAdmin();
  const [list, deletions] = await Promise.all([listTenants(admin), listDeletions(admin)]);
  const active = list.filter((t) => t.active);

  return (
    <>
      <PageHeader title="Empresas" />
      <p className="-mt-3 mb-6 text-muted">
        {active.length} {active.length === 1 ? "ativa" : "ativas"}, {list.length - active.length}{" "}
        {list.length - active.length === 1 ? "suspensa" : "suspensas"},{" "}
        {active.reduce((s, t) => s + t.orders30, 0)} pedidos nos últimos 30 dias
      </p>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel overflow-x-auto">
          {list.length ? (
            <table className="table min-w-[34rem]">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th className="text-right">Pessoas</th>
                  <th className="text-right">Pedidos 30d</th>
                  <th>Último pedido</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const idle = daysAgo(t.lastOrder);
                  return (
                    <tr key={t.id} className={t.active ? "" : "text-muted"}>
                      <td>
                        <p className="font-medium">
                          {t.name}
                          {!t.active && <span className="ml-2 rounded bg-danger-soft px-1.5 py-0.5 text-xs font-semibold text-danger">suspensa</span>}
                        </p>
                        {!t.active && t.suspendedAt && (
                          <p className={`text-[13px] ${daysAgo(t.suspendedAt)! > DELETE_DEADLINE_DAYS ? "font-medium text-danger" : "text-muted"}`}>
                            Suspensa {daysAgo(t.suspendedAt) === 0 ? "hoje" : `há ${daysAgo(t.suspendedAt)} ${daysAgo(t.suspendedAt) === 1 ? "dia" : "dias"}`}
                            {daysAgo(t.suspendedAt)! > DELETE_DEADLINE_DAYS && `: passou dos ${DELETE_DEADLINE_DAYS} dias da política, exclua os dados`}
                          </p>
                        )}
                        <p className="text-sm text-muted">{t.owner ?? "sem dono"}, desde {fmtDateTime(t.createdAt).split(" ")[0].replace(",", "")}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                          <a href={`/admin/exportar?empresa=${t.id}`} className="text-[13px] text-muted hover:text-fg">Exportar</a>
                          <PopoverForm align="left" label="Redefinir acesso" action={resetOwnerAccessAction} submit="Redefinir" confirm="A senha do dono será trocada e o 2FA dele desligado. Continuar?">
                            <input type="hidden" name="tenantId" value={t.id} />
                            <label className="label mb-0" htmlFor={`o-${t.id}`}>Senha nova do dono</label>
                            <input id={`o-${t.id}`} name="password" type="text" minLength={8} required autoComplete="off" className="input" />
                          </PopoverForm>
                          {!t.active && (
                            <PopoverForm
                              align="left"
                              label="Excluir"
                              action={deleteTenantAction}
                              submit="Excluir de vez"
                              danger
                              confirm={`Apagar todos os dados de ${t.name}? Não tem volta.`}
                            >
                              <input type="hidden" name="tenantId" value={t.id} />
                              <p className="text-[13px] text-muted">
                                Apaga clientes, pedidos, caixa, estoque, equipe e histórico. Não tem volta.{" "}
                                <a href={`/admin/exportar?empresa=${t.id}`} className="underline">Exporte antes</a>.
                              </p>
                              <label className="label mb-0" htmlFor={`d-${t.id}`}>Digite o nome da empresa</label>
                              <input id={`d-${t.id}`} name="confirmName" required autoComplete="off" placeholder={t.name} className="input" />
                            </PopoverForm>
                          )}
                          <ActionForm
                            action={toggleTenantAction}
                            confirm={t.active ? `Suspender ${t.name}? Ninguém da empresa vai conseguir entrar.` : undefined}
                          >
                            <input type="hidden" name="tenantId" value={t.id} />
                            <input type="hidden" name="active" value={String(!t.active)} />
                            <button className={`btn sm:h-8 ${t.active ? "btn-danger" : ""}`}>{t.active ? "Suspender" : "Reativar"}</button>
                          </ActionForm>
                        </div>
                      </td>
                      <td className="num text-right">{t.people}</td>
                      <td className="num text-right">{t.orders30}</td>
                      <td className={idle !== null && idle > 7 && t.active ? "font-medium text-warn-fg" : ""}>
                        {idle === null ? "nunca" : idle === 0 ? "hoje" : `há ${idle} ${idle === 1 ? "dia" : "dias"}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty>Nenhuma empresa ainda. Crie a primeira ao lado.</Empty>
          )}
        </section>

        {deletions.length > 0 && (
          <section className="panel lg:col-start-1">
            <h2 className="h2 border-b border-line px-4 py-3">Exclusões feitas</h2>
            <ul>
              {deletions.map((d) => (
                <li key={d.id} className="flex flex-wrap justify-between gap-2 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
                  <span>
                    <span className="font-medium">{d.tenantName}</span>
                    <span className="text-muted">, por {d.deletedBy}</span>
                  </span>
                  <span className="text-muted">
                    {Object.values(d.counts as Record<string, number>).reduce((s, n) => s + n, 0)} registros em {fmtDateTime(d.deletedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel p-4 lg:self-start">
          <h2 className="h2 mb-1">Nova empresa</h2>
          <p className="mb-3 text-sm text-muted">
            Cria a empresa e o acesso do dono. Ele cadastra produtos, equipe e estoque inicial na implantação.
          </p>
          <ActionForm action={createTenantAction} className="space-y-3" reset>
            <div>
              <label className="label" htmlFor="company">Empresa</label>
              <input id="company" name="company" required className="input" placeholder="Ex.: Distribuidora Boa Água" />
            </div>
            <div>
              <label className="label" htmlFor="ownerName">Nome do dono</label>
              <input id="ownerName" name="ownerName" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="email">E-mail de acesso do dono</label>
              <input id="email" name="email" type="email" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="password">Senha inicial</label>
              <input id="password" name="password" type="text" minLength={8} required autoComplete="off" className="input" />
              <p className="mt-1 text-sm text-muted">Combine com o dono de trocar no primeiro acesso.</p>
            </div>
            <button className="btn btn-primary">Criar empresa</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
