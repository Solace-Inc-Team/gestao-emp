import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { orderPix, pedidoAcompanhado } from "@/domain/portal";
import { PixBox } from "@/components/pix-box";
import { fmtDateTime, fmtTime } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { AtualizaSozinho } from "./atualiza";

// Página que o cliente abre pelo link do pedido: a situação em destaque, o caminho até a porta
// (recebido, saiu, entregue) e o que foi pedido. Sem login; o código do link é a chave.
export const metadata: Metadata = { title: "Acompanhar pedido", robots: { index: false } };

// hora sozinha só para hoje; de outro dia vai com a data, senão "20:46" parece de agora há pouco
const quando = (d: Date) => (fmtDateTime(d).slice(0, 10) === fmtDateTime(new Date()).slice(0, 10) ? fmtTime(d) : fmtDateTime(d));

const pagamento = { dinheiro: "Dinheiro na entrega", cartao: "Cartão na entrega", pix: "Pix", fiado: "Fiado" } as const;

export default async function Acompanhar({ params }: PageProps<"/pedir/[slug]/acompanhar/[codigo]">) {
  const { slug, codigo } = await params;
  const achado = await pedidoAcompanhado(slug, codigo);
  if (!achado) notFound();
  const { loja, pedido: p, itens } = achado;

  const cancelado = p.status === "cancelado" || p.status === "estornado";
  const entregue = p.status === "entregue";
  const naRua = p.status === "em_rota";
  const quem = p.entregador ? ` com ${p.entregador}` : "";
  const manchete = cancelado
    ? "Pedido cancelado"
    : entregue
      ? "Entregue"
      : naRua
        ? `Saiu para entrega${quem}`
        : "Recebido, a loja está separando";
  // Pix que ainda não caiu: o cliente pode pagar daqui mesmo
  const pix = p.paymentMethod === "pix" && !p.pixConfirmedAt && !cancelado ? orderPix(loja, { number: p.number, totalCents: p.totalCents - p.cashPartCents }) : null;

  const etapas = [
    { nome: "Pedido recebido", hora: p.createdAt, feita: true },
    { nome: `Saiu para entrega${quem}`, hora: p.dispatchedAt, feita: naRua || entregue },
    { nome: "Entregue", hora: p.deliveredAt, feita: entregue },
  ];
  // a etapa da vez é a primeira ainda não feita; ela pulsa enquanto o pedido anda
  const daVez = cancelado ? -1 : etapas.findIndex((e) => !e.feita);

  return (
    <main className="stagger mx-auto min-h-screen max-w-lg px-4 py-8">
      <AtualizaSozinho ativo={!cancelado && !entregue} />
      <p className="text-[13px] text-muted">{loja.name}</p>
      <h1 className="h1">Pedido #{p.number}</h1>

      <section className="panel mt-6 p-5" aria-live="polite">
        <p className="flex items-center gap-2.5 text-[1.375rem] leading-tight font-semibold tracking-[-0.02em]">
          {!cancelado && !entregue && <span aria-hidden="true" className="status-vivo size-2 shrink-0 rounded-full bg-ok" />}
          {manchete}
        </p>
        {cancelado ? (
          <p className="mt-2 text-muted">Se tiver alguma dúvida, fale com a loja.</p>
        ) : (
          // a lista muda de chave quando a situação muda: a etapa nova chega com movimento, não aparece de repente
          <ol key={p.status} className="etapas mt-5">
            {etapas.map((e, i) => (
              <li key={e.nome} data-feita={e.feita || undefined} data-vez={i === daVez || undefined} style={{ "--i": i } as React.CSSProperties}>
                <span className={e.feita ? "" : "text-muted"}>{e.nome}</span>
                {e.hora && <span className="num text-[13px] text-muted">{quando(e.hora)}</span>}
              </li>
            ))}
          </ol>
        )}
        {p.occurrence && !naRua && !entregue && !cancelado && (
          <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-[13px] text-warn-fg">
            Não conseguimos entregar da última vez ({p.occurrence}). A loja vai combinar com você e mandar de novo.
          </p>
        )}
      </section>

      <section className="panel mt-4 p-5">
        <ul className="space-y-1.5">
          {itens.map((i) => (
            <li key={i.nome} className="flex justify-between gap-4">
              <span>
                <span className="num text-muted">{i.quantidade}×</span> {i.nome}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-muted">{pagamento[p.paymentMethod]}</span>
          <span className="num text-xl font-semibold">{formatBRL(p.totalCents)}</span>
        </div>
        {p.paymentMethod === "pix" && p.pixConfirmedAt && <p className="mt-2 text-[13px] text-ok">Pix recebido pela loja.</p>}
      </section>

      {pix && (
        <section className="panel mt-4 space-y-3 p-5">
          <p className="font-semibold">Pague com Pix</p>
          <PixBox code={pix} />
          <p className="text-[13px] text-muted">O pedido sai normalmente; a loja confere o Pix no extrato.</p>
        </section>
      )}

      {!cancelado && !entregue && <p className="mt-6 text-center text-[13px] text-muted">Esta página se atualiza sozinha.</p>}
    </main>
  );
}
