import { requireUser } from "@/lib/auth";
import { getSettings } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { saveSettingsAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { CopyButton } from "@/components/copy-button";

export const metadata = { title: "Configurações" };

export default async function Configuracoes() {
  const user = await requireUser("dono");
  const s = await getSettings(user.tenantId);
  const h = await headers();
  const portalUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/pedir/${s.slug}`;
  const qr = s.portalEnabled ? await QRCode.toString(portalUrl, { type: "svg", margin: 1, width: 160 }) : null;
  return (
    <>
      <PageHeader title="Configurações" description="Regras da casa. Valem para toda a equipe a partir do próximo pedido." />
      <section className="panel max-w-xl p-4">
        <ActionForm action={saveSettingsAction} className="space-y-4">
          <input type="hidden" name="section" value="regras" />
          <div>
            <label className="label" htmlFor="staffDiscountPct">Desconto máximo que a equipe pode dar (%)</label>
            <input id="staffDiscountPct" name="staffDiscountPct" type="number" min={0} max={100} required defaultValue={s.staffDiscountPct} className="input w-28" />
            <p className="mt-1 text-[13px] text-muted">Sobre o valor dos produtos. Acima disso, só você lança. Use 0 para ninguém da equipe dar desconto.</p>
          </div>
          <div>
            <label className="label" htmlFor="lateAfterMinutes">Pedido conta como atrasado depois de (minutos)</label>
            <input id="lateAfterMinutes" name="lateAfterMinutes" type="number" min={10} max={1440} required defaultValue={s.lateAfterMinutes} className="input w-28" />
            <p className="mt-1 text-[13px] text-muted">Contado desde o lançamento. Os atrasados ficam em destaque na tela de Entregas e no Painel.</p>
          </div>
          <button className="btn btn-primary">Salvar regras</button>
        </ActionForm>
      </section>
      <section className="panel mt-6 max-w-xl p-4">
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
        <ActionForm action={saveSettingsAction} className="space-y-3">
          <input type="hidden" name="section" value="portal" />
          <fieldset className="space-y-3">
            <legend className="font-semibold">Pedidos pelo site</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="portalEnabled" defaultChecked={s.portalEnabled} />
              Clientes podem fazer pedidos pelo link da empresa
            </label>
            <p className="text-[13px] text-muted">Os pedidos entram na fila de Entregas com origem “Portal”. O preço é sempre o da tabela de produtos.</p>
          </fieldset>
          <button className="btn btn-primary">Salvar portal</button>
        </ActionForm>
      </section>
      {s.portalEnabled && qr && (
        <section className="panel mt-6 flex max-w-xl flex-wrap items-center gap-5 p-4">
          <div className="rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="min-w-0 flex-1">
            <h2 className="h2 mb-1">Link de pedidos</h2>
            <p className="text-[13px] text-muted">Mande no WhatsApp, coloque na bio ou imprima o QR para a porta da loja.</p>
            <a href={portalUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-accent underline">{portalUrl}</a>
            <div className="mt-3">
              <CopyButton text={portalUrl} label="Copiar link" />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
