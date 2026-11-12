"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import QRCode from "qrcode";
import { CircleAlert } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { formatBRL } from "@/lib/money";
import { LiveNumber } from "@/components/live-number";
import { CheckDrawn } from "@/components/ui";
import type { PortalResult } from "@/app/actions";

type Product = { id: string; name: string; priceCents: number; returnable: boolean; containerPriceCents: number };

const payments = [
  ["pix", "Pix"],
  ["dinheiro", "Dinheiro na entrega"],
  ["cartao", "Cartão na entrega"],
] as const;

export function PortalForm({
  action,
  products,
  pixEnabled,
}: {
  action: (fd: FormData) => Promise<PortalResult>;
  products: Product[];
  pixEnabled: boolean;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [noBottle, setNoBottle] = useState<Record<string, boolean>>({});
  const [payment, setPayment] = useState<(typeof payments)[number][0]>(pixEnabled ? "pix" : "dinheiro");
  const [result, setResult] = useState<PortalResult>();
  const [pending, start] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (result?.error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [result]);

  const price = (p: Product) => p.priceCents + (p.returnable && noBottle[p.id] ? p.containerPriceCents : 0);
  const items = products
    .filter((p) => qty[p.id] > 0)
    .map((p) => ({ productId: p.id, quantity: qty[p.id], returnsEmpty: p.returnable && !noBottle[p.id] }));
  const total = products.reduce((s, p) => s + (qty[p.id] ?? 0) * price(p), 0);
  const step = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(20, (q[id] ?? 0) + d)) }));

  if (result?.number)
    return (
      <Done
        number={result.number}
        totalCents={result.totalCents!}
        pix={result.pix ?? null}
        lines={products.filter((p) => qty[p.id] > 0).map((p) => `${qty[p.id]} x ${p.name}`)}
      />
    );

  return (
    <form
      method="post"
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setResult(await action(fd)));
      }}
    >
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="paymentMethod" value={payment} />
      {/* armadilha para robô: escondido de quem usa a tela */}
      <input name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      <fieldset disabled={pending} className="space-y-6">
        <section className="panel">
          <h2 className="h2 border-b border-line px-4 py-3">Produtos</h2>
          <ul>
            {products.map((p) => {
              const n = qty[p.id] ?? 0;
              return (
                <li key={p.id} className="border-b border-line px-4 py-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="num text-sm text-muted">{formatBRL(p.priceCents)}</p>
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={`Quantidade de ${p.name}`}>
                      <button type="button" className="btn h-11 w-11 px-0 text-xl" onClick={() => step(p.id, -1)} aria-label="Diminuir">−</button>
                      <span key={n} className="bump num w-9 text-center text-xl font-semibold" aria-live="polite">{n}</span>
                      <button type="button" className="btn h-11 w-11 px-0 text-xl" onClick={() => step(p.id, 1)} aria-label="Aumentar">+</button>
                    </div>
                  </div>
                  {n > 0 && p.returnable && (
                    <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!noBottle[p.id]} onChange={(e) => setNoBottle((b) => ({ ...b, [p.id]: e.target.checked }))} />
                      Não tenho vasilhame vazio para trocar
                      {p.containerPriceCents > 0 && <span className="text-muted">(+{formatBRL(p.containerPriceCents)} cada)</span>}
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel space-y-3 p-4">
          <h2 className="h2">Entrega</h2>
          <div>
            <label className="label" htmlFor="name">Seu nome</label>
            <input id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Telefone com DDD</label>
            <input id="phone" name="phone" required maxLength={30} inputMode="tel" autoComplete="tel" className="input" placeholder="(11) 98888-7777" />
          </div>
          <div>
            <label className="label" htmlFor="address">Endereço</label>
            <input id="address" name="address" required minLength={5} maxLength={200} autoComplete="street-address" className="input" placeholder="Rua, número, bairro" />
          </div>
          <div>
            <label className="label" htmlFor="reference">Ponto de referência (opcional)</label>
            <input id="reference" name="reference" maxLength={200} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="notes">Observação (opcional)</label>
            <input id="notes" name="notes" maxLength={300} className="input" placeholder="Ex.: tocar o interfone 12" />
          </div>
        </section>

        <section className="panel space-y-3 p-4">
          <h2 className="h2">Pagamento</h2>
          <div className="grid gap-2">
            {payments
              .filter(([v]) => v !== "pix" || pixEnabled)
              .map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={payment === v}
                  onClick={() => setPayment(v)}
                  className={`btn justify-start ${payment === v ? "border-fg bg-fg text-bg hover:bg-fg" : ""}`}
                >
                  {l}
                </button>
              ))}
          </div>
          {payment === "dinheiro" && (
            <div>
              <label className="label" htmlFor="changeFor">Precisa de troco para quanto? (opcional)</label>
              <input id="changeFor" name="changeFor" inputMode="decimal" maxLength={12} className="input" placeholder="100,00" />
            </div>
          )}
          {payment === "pix" && <p className="text-sm text-muted">Depois de enviar, aparece o QR e o código Pix com o valor do pedido.</p>}
        </section>

        {result?.error && (
          <p ref={errorRef} role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
            <CircleAlert size={16} strokeWidth={2} className="mt-px shrink-0" aria-hidden="true" />
            {result.error}
          </p>
        )}

        <div className="panel p-4">
          <p className="flex items-baseline justify-between">
            <span className="font-semibold">Total</span>
            <LiveNumber value={total} cents className="text-3xl font-semibold" />
          </p>
          <p className="mt-1 text-[13px] text-muted">Taxa de entrega, se houver, é combinada pela loja. Até 20 unidades de cada produto pelo site.</p>
          <button className="btn btn-primary mt-4 h-12 w-full text-lg" disabled={!items.length || pending}>
            {pending ? "Enviando…" : "Fazer pedido"}
          </button>
          {!items.length && <p className="mt-2 text-center text-[13px] text-muted">Escolha ao menos um produto acima.</p>}
        </div>
      </fieldset>
    </form>
  );
}

function Done({ number, totalCents, pix, lines }: { number: number; totalCents: number; pix: string | null; lines: string[] }) {
  const [qr, setQr] = useState<string>();
  useEffect(() => {
    if (pix) QRCode.toString(pix, { type: "svg", margin: 1, width: 200 }).then(setQr);
  }, [pix]);
  return (
    <section className="enter panel space-y-4 p-5" role="status">
      <p className="flex items-center gap-2 text-lg font-semibold">
        <CheckDrawn className="size-6 text-ok" />
        Pedido #{number} recebido
      </p>
      <ul className="text-muted">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p>
        Total de <b className="num">{formatBRL(totalCents)}</b>. A loja já está vendo seu pedido e vai separar para entrega.
      </p>
      {pix && (
        <div style={{ animationDelay: "350ms" }} className="enter space-y-3 border-t border-line pt-4">
          <p className="font-semibold">Pague com Pix</p>
          {/* SVG gerado no próprio navegador a partir do código Pix */}
          {qr && <div className="w-fit rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />}
          <p className="num rounded-md bg-subtle p-2 text-[12px] break-all">{pix}</p>
          <CopyButton text={pix} />
          <p className="text-[13px] text-muted">Copie o código e cole no app do seu banco, na opção Pix copia e cola. O pedido sai normalmente; a loja confere o Pix no extrato.</p>
        </div>
      )}
    </section>
  );
}
