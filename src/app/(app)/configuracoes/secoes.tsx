import { headers } from "next/headers";
import QRCode from "qrcode";
import { getSettings } from "@/domain/queries";
import { listFiliais } from "@/domain/filiais";
import { ActionForm } from "@/components/action-form";
import { CaixaQueSalva } from "@/components/caixa-que-salva";
import { CopyButton } from "@/components/copy-button";
import { Revelar } from "@/components/revelar";
import {
  ativarFilialAction,
  conectarMercadoPagoAction,
  criarFilialAction,
  desconectarMercadoPagoAction,
  saveSettingsAction,
} from "@/app/actions";

// As quatro seções da janela de Configurações (o que se ajusta uma vez). Renderizadas no servidor e entregues
// prontas à janela, que só mostra a escolhida: trocar de seção não carrega nada.
export async function secoesConfig(tenantId: string) {
  const [s, filiais] = await Promise.all([getSettings(tenantId), listFiliais(tenantId)]);
  const h = await headers();
  const portalUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/pedir/${s.slug}`;
  // um link por filial ativa; a principal fica com o link de sempre
  const ativas = filiais.filter((b) => b.active);
  const links = s.portalEnabled
    ? await Promise.all(
        ativas.map(async (b) => {
          const url = b.main ? portalUrl : `${portalUrl}?filial=${b.slug}`;
          return { id: b.id, nome: ativas.length > 1 ? b.name : null, url, qr: await QRCode.toString(url, { type: "svg", margin: 1, width: 120 }) };
        }),
      )
    : [];

  return {
    regras: (
      <ActionForm action={saveSettingsAction} className="space-y-5">
        <input type="hidden" name="section" value="regras" />
        <div>
          <label className="label" htmlFor="staffDiscountPct">Desconto máximo da equipe (%)</label>
          <input id="staffDiscountPct" name="staffDiscountPct" type="number" min={0} max={100} required defaultValue={s.staffDiscountPct} className="input w-28" />
          <p className="mt-1 text-[13px] text-muted">Acima disso, só você lança.</p>
        </div>
        <div>
          <label className="label" htmlFor="lateAfterMinutes">Pedido atrasado depois de (minutos)</label>
          <input id="lateAfterMinutes" name="lateAfterMinutes" type="number" min={10} max={1440} required defaultValue={s.lateAfterMinutes} className="input w-28" />
        </div>
        <button className="btn btn-primary">Salvar</button>
      </ActionForm>
    ),

    pagamentos: (
      <div className="space-y-8">
        <ActionForm action={saveSettingsAction} className="space-y-3">
          <input type="hidden" name="section" value="pix" />
          <h3 className="font-semibold">Chave Pix</h3>
          <div>
            <label className="label" htmlFor="pixKey">Chave</label>
            <input id="pixKey" name="pixKey" maxLength={77} defaultValue={s.pixKey} className="input" placeholder="CNPJ, e-mail, telefone ou aleatória" />
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
          <button className="btn btn-primary">Salvar</button>
        </ActionForm>

        <div className="border-t border-line pt-6">
          <h3 className="font-semibold">Mercado Pago</h3>
          {s.mpConta ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-subtle px-3 py-2.5">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-ok" />
                <span className="truncate">{s.mpConta}</span>
              </p>
              <ActionForm action={desconectarMercadoPagoAction} confirm="Desconectar o Mercado Pago? Os próximos Pix voltam a ser conferidos à mão.">
                <button className="tap text-[13px] text-muted hover:text-danger">Desconectar</button>
              </ActionForm>
            </div>
          ) : (
            <>
              <p className="mt-1 mb-3 text-[13px] text-muted">Confirma o Pix de cada pedido sozinho.</p>
              <Revelar label="Conectar conta">
                <ActionForm action={conectarMercadoPagoAction} className="space-y-3 pt-3" reset>
                  <div>
                    <label className="label" htmlFor="mp-token">Access Token</label>
                    <input id="mp-token" name="token" type="password" required autoComplete="off" spellCheck={false} className="input num" placeholder="APP_USR-..." />
                    <p className="mt-1 text-[13px] text-muted">Em mercadopago.com.br/developers, Credenciais de produção.</p>
                  </div>
                  <div>
                    <label className="label" htmlFor="mp-senha">Sua senha</label>
                    <input id="mp-senha" name="confirmPassword" type="password" autoComplete="current-password" required className="input sm:max-w-xs" />
                  </div>
                  <button className="btn btn-primary">Conectar</button>
                </ActionForm>
              </Revelar>
            </>
          )}
        </div>
      </div>
    ),

    site: (
      <div className="space-y-6">
        <ActionForm action={saveSettingsAction}>
          <input type="hidden" name="section" value="portal" />
          {/* salva ao marcar */}
          <label className="flex min-h-11 items-center gap-2">
            <CaixaQueSalva name="portalEnabled" defaultChecked={s.portalEnabled} />
            Clientes podem pedir pelo link
          </label>
        </ActionForm>
        {links.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
            <div className="rounded-md bg-white p-1.5" dangerouslySetInnerHTML={{ __html: l.qr }} />
            <div className="min-w-0 flex-1">
              {l.nome && <p className="font-medium">{l.nome}</p>}
              <a href={l.url} target="_blank" rel="noreferrer" className="block text-[13px] break-all text-accent underline">{l.url}</a>
              <div className="mt-3">
                <CopyButton text={l.url} label="Copiar link" />
              </div>
            </div>
          </div>
        ))}
      </div>
    ),

    filiais: (
      <div>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {filiais.map((b) => (
            <li key={b.id} className={`flex min-h-12 items-center justify-between gap-3 px-3 py-2 ${b.active ? "" : "text-muted"}`}>
              <p className="min-w-0 truncate">
                <span className="font-medium">{b.name}</span>
                {b.main && b.name.toLowerCase() !== "principal" && <span className="ml-2 text-[12px] text-muted">principal</span>}
                {!b.active && <span className="ml-2 text-[12px] text-muted">desativada</span>}
                <span className="ml-2 text-[12px] text-muted">{b.equipe === 1 ? "1 pessoa" : `${b.equipe} pessoas`}</span>
              </p>
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
        <ActionForm action={criarFilialAction} className="mt-4 flex items-end gap-2" reset>
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="filial-nome">Nova filial</label>
            <input id="filial-nome" name="name" required minLength={2} maxLength={60} className="input" placeholder="Ex.: Centro" />
          </div>
          <button className="btn">Criar</button>
        </ActionForm>
      </div>
    ),
  };
}
