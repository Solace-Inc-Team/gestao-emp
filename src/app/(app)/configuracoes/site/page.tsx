import { requireUser } from "@/lib/auth";
import { getSettings } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { saveSettingsAction } from "@/app/actions";
import { listFiliais } from "@/domain/filiais";
import { PageHeader } from "@/components/ui";
import { ConfigNav } from "@/components/config-nav";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { CopyButton } from "@/components/copy-button";
import { CaixaQueSalva } from "@/components/caixa-que-salva";

export const metadata = { title: "Pedidos pelo site" };

export default async function Site() {
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
      <ConfigNav />
      <PageHeader title="Pedidos pelo site" description="O cliente pede sozinho pelo link ou pelo QR, sem ligar." />
      <section className="panel max-w-xl p-4">
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
    </>
  );
}
