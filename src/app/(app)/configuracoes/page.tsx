import { requireUser } from "@/lib/auth";
import { getSettings } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { ativarFilialAction, criarFilialAction, saveSettingsAction } from "@/app/actions";
import { listFiliais } from "@/domain/filiais";
import { PageHeader } from "@/components/ui";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { CopyButton } from "@/components/copy-button";
import { CaixaQueSalva } from "@/components/caixa-que-salva";

export const metadata = { title: "Configurações" };

export default async function Configuracoes() {
  const user = await requireUser("dono");
  const [s, filiais] = await Promise.all([getSettings(user.tenantId), listFiliais(user.tenantId)]);
  const h = await headers();
  const portalUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/pedir/${s.slug}`;
  // um link por filial ativa; a principal fica com o link de sempre, sem o ?filial
  const ativas = filiais.filter((b) => b.active);
  const links = s.portalEnabled
    ? await Promise.all(
        ativas.map(async (b) => {
          const url = b.main ? portalUrl : `${portalUrl}?filial=${b.slug}`;
          return { id: b.id, nome: ativas.length > 1 ? b.name : null, url, qr: await QRCode.toString(url, { type: "svg", margin: 1, width: 160 }) };
        }),
      )
    : [];
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
            {/* uma caixinha só: salva ao marcar, sem botão à parte (o aviso de salvo aparece embaixo) */}
            <label className="flex min-h-11 items-center gap-2">
              <CaixaQueSalva name="portalEnabled" defaultChecked={s.portalEnabled} />
              Clientes podem fazer pedidos pelo link da empresa
            </label>
            <p className="text-[13px] text-muted">Os pedidos entram na fila de Entregas com origem “Portal”. O preço é sempre o da tabela de produtos.</p>
          </fieldset>
        </ActionForm>
      </section>
      {links.map((l) => (
        <section key={l.id} className="panel mt-6 flex max-w-xl flex-wrap items-center gap-5 p-4">
          <div className="rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: l.qr }} />
          <div className="min-w-0 flex-1">
            <h2 className="h2 mb-1">{l.nome ? `Link de pedidos: ${l.nome}` : "Link de pedidos"}</h2>
            <p className="text-[13px] text-muted">
              {l.nome ? "Os pedidos deste link caem na fila desta filial. " : ""}Mande no WhatsApp, coloque na bio ou imprima o QR para a porta da loja.
            </p>
            <a href={l.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-accent underline">{l.url}</a>
            <div className="mt-3">
              <CopyButton text={l.url} label="Copiar link" />
            </div>
          </div>
        </section>
      ))}
      <section className="panel mt-6 max-w-xl">
        <div className="border-b border-line p-4">
          <h2 className="h2">Filiais</h2>
          <p className="mt-0.5 text-[13px] text-muted">Cada filial tem o próprio estoque, equipe e caixa. Clientes, produtos e preços valem para todas.</p>
        </div>
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
