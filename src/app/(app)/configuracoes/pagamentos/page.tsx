import { requireUser } from "@/lib/auth";
import { getSettings } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { conectarMercadoPagoAction, desconectarMercadoPagoAction, saveSettingsAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { ConfigNav } from "@/components/config-nav";
import { Revelar } from "@/components/revelar";

export const metadata = { title: "Pagamentos" };

export default async function Pagamentos() {
  const user = await requireUser("dono");
  const s = await getSettings(user.tenantId);
  return (
    <>
      <ConfigNav />
      <PageHeader title="Pagamentos" description="Como o Pix dos pedidos chega até você." />
      <section className="panel max-w-xl p-4">
        <ActionForm action={saveSettingsAction} className="space-y-3">
          <input type="hidden" name="section" value="pix" />
          <fieldset className="space-y-3">
            <legend className="font-semibold">Pix da empresa</legend>
            <p className="text-[13px] text-muted">
              Com a chave preenchida, cada pedido no Pix ganha um QR e um código copia e cola com o valor e o número do pedido. O dinheiro cai direto na sua conta;
              o caixa ou você marca “Pix conferido” depois de ver no extrato.
            </p>
            <div>
              <label className="label" htmlFor="pixKey">Chave Pix</label>
              <input id="pixKey" name="pixKey" maxLength={77} defaultValue={s.pixKey} className="input" placeholder="CNPJ, e-mail, telefone ou chave aleatória" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pixName">Nome do recebedor</label>
                <input id="pixName" name="pixName" maxLength={60} defaultValue={s.pixName} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="pixCity">Cidade</label>
                <input id="pixCity" name="pixCity" maxLength={40} defaultValue={s.pixCity} className="input" />
              </div>
            </div>
          </fieldset>
          <button className="btn btn-primary">Salvar Pix</button>
        </ActionForm>
      </section>
      <section className="panel mt-6 max-w-xl p-4">
        <h2 className="h2 mb-1">Mercado Pago</h2>
        {s.mpConta ? (
          <>
            <p className="text-[13px] text-muted">
              Cada pedido no Pix vira uma cobrança na sua conta, com o valor certo, e o pedido fica pago sozinho quando o cliente paga. A chave Pix fica de reserva.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-subtle px-3 py-2.5">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-ok" />
                <span className="truncate">Conectado a <span className="font-medium">{s.mpConta}</span></span>
              </p>
              <ActionForm action={desconectarMercadoPagoAction} confirm="Desconectar o Mercado Pago? Os próximos Pix voltam a ser conferidos à mão no extrato.">
                <button className="tap text-[13px] text-muted hover:text-danger">Desconectar</button>
              </ActionForm>
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-[13px] text-muted">
              Conecte a conta da empresa e o Pix de cada pedido passa a ser confirmado sozinho, sem conferir extrato. O dinheiro cai direto na sua conta do Mercado Pago.
            </p>
            <Revelar label="Conectar conta do Mercado Pago">
              <ActionForm action={conectarMercadoPagoAction} className="space-y-3 pt-3" reset>
                <ol className="list-decimal space-y-1 pl-4 text-[13px] text-muted">
                  <li>Entre em mercadopago.com.br/developers com a conta da empresa e abra <b className="font-medium text-fg">Suas integrações</b>.</li>
                  <li>Crie uma aplicação (pagamentos online) e abra <b className="font-medium text-fg">Credenciais de produção</b>.</li>
                  <li>Copie o <b className="font-medium text-fg">Access Token</b> e cole abaixo.</li>
                </ol>
                <div>
                  <label className="label" htmlFor="mp-token">Access Token</label>
                  <input id="mp-token" name="token" type="password" required autoComplete="off" spellCheck={false} className="input num" placeholder="APP_USR-..." />
                </div>
                <div>
                  <label className="label" htmlFor="mp-senha">Sua senha, para confirmar</label>
                  <input id="mp-senha" name="confirmPassword" type="password" autoComplete="current-password" required className="input sm:max-w-xs" />
                </div>
                <button className="btn btn-primary">Conectar</button>
              </ActionForm>
            </Revelar>
          </>
        )}
      </section>
    </>
  );
}
