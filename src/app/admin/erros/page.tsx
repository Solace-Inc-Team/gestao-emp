import { CircleCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { alertsConfigured, listErrors } from "@/domain/monitoring";
import { resolveErrorAction, testAlertAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { PageHeader, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Erros" };

const kindLabel: Record<string, string> = { render: "Página", route: "Download/API", action: "Formulário", proxy: "Proxy" };

export default async function Erros() {
  const admin = await requireAdmin();
  const list = await listErrors(admin);
  const open = list.filter((e) => !e.resolvedAt);
  const alerts = alertsConfigured();

  return (
    <>
      <PageHeader
        title="Erros"
        description={
          alerts
            ? "Erros inesperados do servidor. O Telegram avisa no primeiro de cada tipo e no máximo uma vez por hora."
            : "Erros inesperados do servidor. Alertas no Telegram desligados: configure ALERT_TELEGRAM_BOT_TOKEN e ALERT_TELEGRAM_CHAT_ID."
        }
      >
        <ActionForm action={testAlertAction}>
          <button className="btn">Enviar alerta de teste</button>
        </ActionForm>
      </PageHeader>

      {list.length === 0 ? (
        <div className="panel flex flex-col items-center px-6 py-14 text-center">
          <CircleCheck size={28} strokeWidth={1.5} className="text-ok" aria-hidden="true" />
          <p className="mt-3 font-medium">Nenhum erro registrado</p>
          <p className="mt-1 text-muted">Quando algo falhar no servidor, aparece aqui com quantas vezes aconteceu.</p>
        </div>
      ) : (
        <section className="panel overflow-x-auto">
          <p className="border-b border-line px-4 py-3 text-[13px] text-muted">
            {open.length} em aberto, {list.length - open.length} {list.length - open.length === 1 ? "resolvido" : "resolvidos"}
          </p>
          <table className="table min-w-[48rem]">
            <thead>
              <tr>
                <th>Erro</th>
                <th>Onde</th>
                <th className="text-right">Vezes</th>
                <th>Última vez</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className={e.resolvedAt ? "text-muted" : ""}>
                  <td className="max-w-md">
                    <details>
                      <summary className="cursor-pointer list-none">
                        <span className={`font-medium ${e.resolvedAt ? "line-through" : ""}`}>{e.message.slice(0, 140)}</span>
                      </summary>
                      {e.stack && (
                        <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-subtle p-3 text-[11px] leading-relaxed whitespace-pre-wrap">{e.stack}</pre>
                      )}
                    </details>
                    <p className="text-[13px] text-muted">Primeira vez em {fmtDateTime(e.firstSeen)}</p>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="num text-[13px]">{e.method} {e.path}</span>
                    <p className="text-[13px] text-muted">{kindLabel[e.kind] ?? e.kind}</p>
                  </td>
                  <td className="num text-right font-medium">{e.count}</td>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(e.lastSeen)}</td>
                  <td className="text-right">
                    {e.resolvedAt ? (
                      <span className="text-[13px]">Resolvido</span>
                    ) : (
                      <ActionForm action={resolveErrorAction}>
                        <input type="hidden" name="errorId" value={e.id} />
                        <button className="btn h-8 text-[13px]">Marcar resolvido</button>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
