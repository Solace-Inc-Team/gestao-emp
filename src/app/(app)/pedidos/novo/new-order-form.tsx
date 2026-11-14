"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { createOrderAction } from "@/app/actions";
import { formatBRL, parseBRL } from "@/lib/money";
import { LiveNumber } from "@/components/live-number";
import { Aparece } from "@/components/saida";

type Product = { id: string; name: string; priceCents: number; containerPriceCents: number; returnable: boolean; available: number; reserved: number };
type Customer = { id: string; name: string; phone: string; address: string; addresses?: { id: string; label: string; address: string }[] };
type Driver = { id: string; name: string; onShift: boolean };

const payments = [
  ["dinheiro", "Dinheiro"],
  ["pix", "Pix"],
  ["cartao", "Cartão"],
  ["fiado", "Fiado"],
] as const;

export function NewOrderForm({
  products,
  drivers,
  initialCustomer,
  discountLimitPct,
}: {
  products: Product[];
  drivers: Driver[];
  initialCustomer?: Customer;
  /** null = sem limite (dono) */
  discountLimitPct: number | null;
}) {
  const [mode, setMode] = useState<"entrega" | "balcao">("entrega");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [keepsBottle, setKeepsBottle] = useState<Record<string, boolean>>({}); // true = cliente não tem vazio para trocar
  // sem vazio: a loja vende o casco ou empresta (comodato); comodato só com cliente identificado
  const [emprestado, setEmprestado] = useState<Record<string, boolean>>({});
  const comodato = (p: Product) => p.returnable && !!keepsBottle[p.id] && !!emprestado[p.id] && !!customer;
  const [customer, setCustomer] = useState<Customer | undefined>(initialCustomer);
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<{ q: string; list: Customer[] }>({ q: "", list: [] });
  const [creating, setCreating] = useState(false);
  const [payment, setPayment] = useState<(typeof payments)[number][0]>("dinheiro");
  const [fee, setFee] = useState("");
  const [discount, setDiscount] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // campo que existe sempre: a busca some quando o cliente já está escolhido
  const modeRef = useRef<HTMLInputElement>(null);

  // atalhos de quem atende no teclado: "/" vai para a busca de cliente, Ctrl+Enter lança
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        modeRef.current?.form?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // busca no servidor enquanto digita; a resposta de uma busca antiga não sobrescreve a nova
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/clientes/busca?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((list: Customer[]) => setMatches({ q, list }))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [search]);
  const q = search.trim();
  const shown = q.length >= 2 ? matches.list : [];
  const nothingFound = q.length >= 2 && matches.q === q && matches.list.length === 0;

  const items = products
    .filter((p) => qty[p.id] > 0)
    .map((p) => ({ productId: p.id, quantity: qty[p.id], returnsEmpty: p.returnable && !keepsBottle[p.id], loan: comodato(p) }));
  const parsedFee = parseBRL(fee) ?? 0;
  // taxa fora do limite não entra no total mostrado; o servidor recusa com a mensagem
  const feeCents = mode === "entrega" && parsedFee >= 0 && parsedFee <= 100_00 ? parsedFee : 0;
  // sem vazio para trocar, o vasilhame entra no preço, a não ser que vá em comodato
  const priceOf = (p: Product) => p.priceCents + (p.returnable && keepsBottle[p.id] && !comodato(p) ? p.containerPriceCents : 0);
  const subtotal = products.reduce((s, p) => s + (qty[p.id] ?? 0) * priceOf(p), 0);
  const parsedDiscount = parseBRL(discount) ?? 0;
  const discountCents = parsedDiscount > 0 && parsedDiscount <= subtotal ? parsedDiscount : 0;
  const overLimit = discountLimitPct !== null && discountCents > Math.floor((subtotal * discountLimitPct) / 100);
  // só pra exibir, o total que vale é calculado no servidor
  const total = subtotal + feeCents - discountCents;
  // o total animado vem num segundo momento: o número do + aparece na hora mesmo em celular fraco
  const shownTotal = useDeferredValue(total);
  const unidades = items.reduce((s, i) => s + i.quantity, 0);
  const step = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(99, (q[id] ?? 0) + d)) }));

  return (
    <ActionForm action={createOrderAction} className="grid gap-6 pb-24 lg:grid-cols-[1fr_20rem] lg:pb-0">
      <input type="hidden" name="mode" value={mode} ref={modeRef} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="customerId" value={creating ? "" : (customer?.id ?? "")} />
      <input type="hidden" name="paymentMethod" value={payment} />

      <div className="space-y-6">
        <div role="tablist" aria-label="Tipo de venda" className="relative inline-grid grid-cols-2 rounded-lg bg-subtle p-1">
          {/* fundo da aba escolhida: desliza para o lado em vez de trocar de repente */}
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-line transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: mode === "balcao" ? "translateX(100%)" : "none" }}
          />
          {(["entrega", "balcao"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`relative min-h-11 rounded-md px-3.5 py-1.5 text-[13px] sm:min-h-0 font-medium transition-colors ${mode === m ? "text-fg" : "text-muted hover:text-fg"}`}
            >
              {m === "entrega" ? "Entrega" : "Venda no balcão"}
            </button>
          ))}
        </div>

        <section className="panel p-4">
          <h2 className="h2 mb-3">Cliente{mode === "balcao" && <span className="text-base font-normal text-muted"> (opcional)</span>}</h2>
          {customer && !creating ? (
            // cada estado do quadro (buscar, cadastrar, escolhido) chega com movimento quando toma o lugar do outro
            <div className="enter flex items-start justify-between gap-3 rounded-md bg-accent-soft p-3">
              <div>
                <p className="font-semibold">{customer.name}</p>
                <p className="text-sm text-muted">{customer.address || "Sem endereço"}</p>
                <p className="text-sm text-muted">{customer.phone}</p>
              </div>
              <button type="button" className="tap text-sm text-accent underline" onClick={() => setCustomer(undefined)}>Trocar</button>
            </div>
          ) : null}
          {customer && !creating && mode === "entrega" && (customer.addresses?.length ?? 0) > 0 && (
            <div className="enter mt-3">
              <label className="label" htmlFor="addressId">Entregar em</label>
              <select id="addressId" name="addressId" className="input" defaultValue="">
                <option value="">Endereço principal: {customer.address || "sem endereço"}</option>
                {customer.addresses!.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}: {a.address}</option>
                ))}
              </select>
            </div>
          )}
          {customer && !creating ? null : creating ? (
            <div className="enter grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="nc-name">Nome</label>
                <input id="nc-name" name="newCustomerName" required maxLength={120} defaultValue={q} className="input" autoFocus />
              </div>
              <div>
                <label className="label" htmlFor="nc-phone">Telefone</label>
                <input id="nc-phone" name="newCustomerPhone" inputMode="tel" maxLength={30} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="nc-ref">Referência</label>
                <input id="nc-ref" name="newCustomerReference" maxLength={200} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="nc-addr">Endereço</label>
                <input id="nc-addr" name="newCustomerAddress" maxLength={200} className="input" />
              </div>
              <button type="button" className="tap text-left text-sm text-accent underline" onClick={() => setCreating(false)}>
                Buscar cliente cadastrado
              </button>
            </div>
          ) : (
            <div className="enter">
              <label className="label" htmlFor="busca">Buscar por nome, telefone ou endereço <span className="hidden font-normal text-muted lg:inline">(atalho: /)</span></label>
              <input id="busca" ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} className="input" autoComplete="off" />
              {shown.length > 0 && (
                <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                  {shown.map((c, i) => (
                    // resultados chegam em sequência rápida; quem já estava na lista não anima de novo
                    <li key={c.id} className="enter" style={{ animationDelay: `${i * 30}ms` }}>
                      <button
                        type="button"
                        onClick={() => { setCustomer(c); setSearch(""); }}
                        className="block w-full px-3 py-2 text-left hover:bg-subtle"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="block text-sm text-muted">{c.address} {c.phone && `(${c.phone})`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {nothingFound && <p className="enter mt-2 text-sm text-muted">Nenhum cliente encontrado.</p>}
              <button type="button" className="tap mt-2 text-sm font-semibold text-accent" onClick={() => setCreating(true)}>
                {nothingFound ? `+ Cadastrar "${q}" como cliente novo` : "+ Cadastrar cliente novo"}
              </button>
            </div>
          )}
        </section>

        <section className="panel">
          <h2 className="h2 border-b border-line px-4 py-3">Produtos</h2>
          <ul>
            {products.map((p) => {
              const n = qty[p.id] ?? 0;
              return (
                <li key={p.id} className={`border-b border-line px-4 py-3 transition-colors duration-300 last:border-0 ${n ? "bg-accent-soft/40" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-muted">
                        <span className="num">{formatBRL(p.priceCents)}</span>, {p.available} {p.returnable ? "cheios livres" : "livres"}
                        {p.reserved > 0 && ` (${p.reserved} em pedidos aguardando)`}
                      </p>
                      {/* o pedido passa mesmo assim (a carga pode chegar antes da entrega), mas a pessoa fica sabendo */}
                      <Aparece quando={n > p.available}>
                        <p className="text-sm font-medium text-warn-fg">Acima do estoque livre ({p.available})</p>
                      </Aparece>
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={`Quantidade de ${p.name}`}>
                      <button type="button" className="btn h-11 w-11 px-0 text-xl" onClick={() => step(p.id, -1)} aria-label="Diminuir">−</button>
                      {/* a chave muda a cada clique e o número dá um pulinho (CSS): mais leve que rolar a cada toque */}
                      <span key={n} aria-live="polite" className="bump num w-10 text-center text-2xl font-semibold">{n}</span>
                      <button type="button" className="btn h-11 w-11 px-0 text-xl" onClick={() => step(p.id, 1)} aria-label="Aumentar">+</button>
                    </div>
                  </div>
                  <Aparece quando={n > 0 && p.returnable}>
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!keepsBottle[p.id]}
                        onChange={(e) => setKeepsBottle((k) => ({ ...k, [p.id]: e.target.checked }))}
                      />
                      Cliente não tem vasilhame para trocar
                    </label>
                  </Aparece>
                  {/* sem vazio: vender o casco ou emprestar; a escolha muda o preço na hora */}
                  {p.returnable && (
                    // sempre na página, recolhida: abre e fecha deslizando; fechada, fica fora do teclado e do leitor de tela
                    <div className="recolhe" data-aberto={(n > 0 && keepsBottle[p.id]) || undefined} inert={!(n > 0 && keepsBottle[p.id])}>
                    <div><div className="flex flex-wrap gap-2 pt-2" role="group" aria-label={`Vasilhame de ${p.name}`}>
                      <button
                        type="button"
                        aria-pressed={!comodato(p)}
                        onClick={() => setEmprestado((e) => ({ ...e, [p.id]: false }))}
                        className={`btn h-9 text-[13px] ${!comodato(p) ? "border-fg bg-fg text-bg hover:bg-fg" : ""}`}
                      >
                        Vender o vasilhame{p.containerPriceCents > 0 && ` (+${formatBRL(p.containerPriceCents)} cada)`}
                      </button>
                      <button
                        type="button"
                        aria-pressed={comodato(p)}
                        disabled={!customer}
                        title={customer ? undefined : "Escolha o cliente para emprestar"}
                        onClick={() => setEmprestado((e) => ({ ...e, [p.id]: true }))}
                        className={`btn h-9 text-[13px] ${comodato(p) ? "border-fg bg-fg text-bg hover:bg-fg" : ""}`}
                      >
                        Emprestar (comodato)
                      </button>
                      {!customer && <p className="w-full text-[12px] text-muted">Comodato precisa do cliente escolhido.</p>}
                    </div></div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">Observações</label>
            <input id="notes" name="notes" maxLength={500} className="input" placeholder="Ex.: deixar na portaria, tocar o interfone 12" />
          </div>
          {/* trocar Entrega e Balcão recolhe e abre os campos da entrega no lugar */}
          <Aparece quando={mode === "entrega"} className="space-y-3">
              <div>
                <label className="label" htmlFor="origin">Pedido chegou por</label>
                <select id="origin" name="origin" className="input" defaultValue="whatsapp">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telefone">Telefone</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="fee">Taxa de entrega</label>
                <input id="fee" name="deliveryFee" maxLength={12} value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className="input" placeholder="0,00" />
              </div>
              <div>
                <label className="label" htmlFor="driver">Entregador</label>
                <select id="driver" name="driverId" className="input" defaultValue="">
                  <option value="">Deixar aguardando</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id} disabled={!d.onShift}>
                      {d.name}{d.onShift ? "" : " (sem turno aberto)"}
                    </option>
                  ))}
                </select>
              </div>
          </Aparece>
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="panel p-4">
          <h2 className="h2 mb-3">Pagamento</h2>
          <div className="grid grid-cols-2 gap-2">
            {payments.map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={payment === v}
                onClick={() => setPayment(v)}
                className={`btn ${payment === v ? "border-fg bg-fg text-bg hover:bg-fg" : ""}`}
              >
                {l}
              </button>
            ))}
          </div>
          <Aparece quando={payment === "dinheiro"} className="pt-3">
              <label className="label" htmlFor="change">Troco para (opcional)</label>
              <input id="change" name="changeFor" maxLength={12} inputMode="decimal" className="input" placeholder="100,00" />
          </Aparece>
          <Aparece quando={payment === "pix" || payment === "cartao"} className="pt-3">
              <label className="label" htmlFor="cashPart">Parte em dinheiro (opcional)</label>
              <input id="cashPart" name="cashPart" inputMode="decimal" maxLength={12} className="input" placeholder="0,00" />
          </Aparece>
          <Aparece quando={payment === "fiado"} className="pt-3">
            <p className="text-sm text-muted">Fiado exige cliente identificado.</p>
          </Aparece>
          <details className="mt-3" open={!!discount}>
            <summary className="tap cursor-pointer text-sm text-accent">Dar desconto</summary>
            <div className="mt-2 space-y-2">
              <div>
                <label className="label" htmlFor="discount">Desconto em R$</label>
                <input id="discount" name="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" maxLength={12} className="input" placeholder="0,00" />
              </div>
              <div>
                <label className="label" htmlFor="discountReason">Motivo</label>
                <input id="discountReason" name="discountReason" maxLength={160} required={discountCents > 0} className="input" placeholder="Ex.: cliente antigo, 10 galões" />
              </div>
              <Aparece quando={parsedDiscount > subtotal && subtotal > 0}>
                <p className="text-[13px] font-medium text-danger">O desconto é maior que o valor dos produtos ({formatBRL(subtotal)}).</p>
              </Aparece>
              <Aparece quando={overLimit}>
                <p className="text-[13px] font-medium text-warn-fg">Acima do seu limite de {discountLimitPct}%. Só o dono consegue lançar este desconto.</p>
              </Aparece>
            </div>
          </details>
          <div className="mt-5 border-t border-line pt-4">
            {/* a lista fica sempre; sem item, só a margem some (junto com a última linha) */}
            <ul className={`text-sm transition-[margin] duration-[var(--dur)] ${items.length ? "mb-3" : ""}`}>
                {/* todos os produtos, recolhidos os que estão em zero: a linha entra e sai deslizando */}
                {products.map((p) => {
                  const q = qty[p.id] ?? 0;
                  return (
                    <li key={p.id} className="recolhe" data-aberto={q > 0 || undefined} aria-hidden={q === 0 || undefined}>
                      <span><span className="flex justify-between gap-2 pb-1">
                        <span>{q}× {p.name}</span>
                        <span className="num">{formatBRL(q * priceOf(p))}</span>
                      </span></span>
                    </li>
                  );
                })}
                <li className="recolhe" data-aberto={(items.length > 0 && feeCents > 0) || undefined} aria-hidden={!(items.length > 0 && feeCents > 0) || undefined}>
                  <span><span className="flex justify-between pb-1"><span>Entrega</span><span className="num">{formatBRL(feeCents)}</span></span></span>
                </li>
                <li className="recolhe" data-aberto={(items.length > 0 && discountCents > 0) || undefined} aria-hidden={!(items.length > 0 && discountCents > 0) || undefined}>
                  <span><span className="flex justify-between pb-1"><span>Desconto</span><span className="num">−{formatBRL(discountCents)}</span></span></span>
                </li>
              </ul>
            <p className="flex items-baseline justify-between">
              <span className="font-semibold">Total</span>
              <LiveNumber value={shownTotal} cents className="text-4xl font-semibold" />
            </p>
            <button className="btn btn-primary mt-4 h-12 w-full text-lg" disabled={!items.length}>
              {mode === "balcao" ? "Registrar venda" : "Lançar pedido"}
            </button>
            <p className="mt-2 hidden text-center text-[13px] text-muted lg:block">Ctrl + Enter também lança</p>
          </div>
        </div>
      </aside>

      {/* no celular o total fica à vista enquanto se escolhe os produtos; o resumo completo segue no fim da página */}
      <div className="barra-pedido fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-line bg-bg/95 px-4 pt-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">
            {unidades ? `${unidades} ${unidades === 1 ? "item" : "itens"}` : "Nenhum produto"}
          </p>
          <LiveNumber value={shownTotal} cents className="text-xl font-semibold" />
        </div>
        <button className="btn btn-primary h-12 shrink-0 px-5" disabled={!items.length}>
          {mode === "balcao" ? "Registrar venda" : "Lançar pedido"}
        </button>
      </div>
    </ActionForm>
  );
}
