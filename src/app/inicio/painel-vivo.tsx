"use client";

import { useEffect, useRef, useState } from "react";
import { HandCoins, LayoutGrid, Package, Plus, ReceiptText, Truck, Users, Wallet } from "lucide-react";
import { Logo } from "@/components/logo";
import { LiveNumber } from "@/components/live-number";
import { StatusBadge } from "@/components/ui";
import { formatBRL } from "@/lib/money";

// O Painel do dia como ele é no sistema, sem moldura, para o topo da página inicial.
// O dia anda sozinho: um pedido em rota é entregue (o vendido sobe), um aguardando sai para a rua,
// chega um pedido novo no alto da lista. Cada número muda por causa da linha que mudou ao lado.
// Fora da tela, com a aba escondida ou com menos movimento pedido, a tela fica parada.

type Status = "aberto" | "em_rota" | "entregue";
type Pedido = { n: number; cliente: string; item: string; cents: number; status: Status; quem?: string };

const NOVOS: Omit<Pedido, "n" | "status">[] = [
  { cliente: "Padaria Pão Quente", item: "2× Galão 20L", cents: 2800 },
  { cliente: "Marta Ribeiro", item: "1× Gás P13", cents: 11500 },
  { cliente: "Escola Pequeno Saber", item: "6× Galão 20L", cents: 8400 },
  { cliente: "Bar do Zé", item: "1× Gás P13", cents: 11500 },
  { cliente: "Cláudia Martins", item: "3× Galão 20L", cents: 4200 },
];
const ENTREGADORES = ["João", "Carlos", "Ana"];

const INICIO: Pedido[] = [
  { n: 61, cliente: "Restaurante Sabor", item: "1× Gás P45", cents: 42000, status: "aberto" },
  { n: 60, cliente: "Diego Alves", item: "1× Gás P13", cents: 11500, status: "em_rota", quem: "Carlos" },
  { n: 59, cliente: "Fernanda Costa", item: "2× Galão 20L", cents: 2800, status: "em_rota", quem: "João" },
  { n: 58, cliente: "Ana Ribeiro", item: "1× Gás P13", cents: 11500, status: "entregue", quem: "Ana" },
  { n: 57, cliente: "Leonardo Kennedy", item: "1× Galão 20L", cents: 1400, status: "entregue", quem: "João" },
];

const nav = [
  [Plus, "Novo pedido"],
  [LayoutGrid, "Painel"],
  [ReceiptText, "Pedidos"],
  [Truck, "Entregas"],
  [Wallet, "Caixa e acertos"],
  [Package, "Estoque"],
  [Users, "Clientes"],
  [HandCoins, "Fiado"],
] as const;

export function PainelVivo() {
  const caixa = useRef<HTMLDivElement>(null);
  const [pedidos, setPedidos] = useState(INICIO);
  // a lista de verdade fica aqui; o estado só redesenha (assim cada passo conta uma vez, mesmo em modo estrito)
  const atual = useRef(INICIO);
  const [mudou, setMudou] = useState<number | null>(null);
  const [vendido, setVendido] = useState({ cents: 116300, entregues: 15 });
  const [ativo, setAtivo] = useState(false);

  // só anda na tela, com a aba à vista e sem pedido de menos movimento
  useEffect(() => {
    const el = caixa.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visto = false;
    const atualiza = () => setAtivo(visto && !document.hidden);
    const io = new IntersectionObserver(([e]) => {
      visto = e.isIntersecting;
      atualiza();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", atualiza);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", atualiza);
    };
  }, []);

  // três passos que se repetem: entrega, saída para a rua, pedido novo
  useEffect(() => {
    if (!ativo) return;
    let passo = 0;
    const id = setInterval(() => {
      const fase = passo++ % 3;
      const lista = atual.current;
      let nova = lista;
      if (fase === 0) {
        const alvo = [...lista].reverse().find((p) => p.status === "em_rota");
        if (alvo) {
          nova = lista.map((p) => (p === alvo ? { ...p, status: "entregue" } : p));
          setMudou(alvo.n);
          setVendido((v) => ({ cents: v.cents + alvo.cents, entregues: v.entregues + 1 }));
        }
      } else if (fase === 1) {
        const alvo = [...lista].reverse().find((p) => p.status === "aberto");
        if (alvo) {
          nova = lista.map((p) => (p === alvo ? { ...p, status: "em_rota", quem: ENTREGADORES[alvo.n % 3] } : p));
          setMudou(alvo.n);
        }
      } else {
        const n = lista[0].n + 1;
        nova = [{ n, ...NOVOS[n % NOVOS.length], status: "aberto" as const }, ...lista].slice(0, 6);
        setMudou(n);
      }
      atual.current = nova;
      setPedidos(nova);
    }, 2600);
    return () => clearInterval(id);
  }, [ativo]);

  const conta = (s: Status) => pedidos.filter((p) => p.status === s).length;
  const naRua = pedidos.filter((p) => p.status === "em_rota").reduce((s, p) => s + p.cents, 0) + 24800;

  return (
    <div ref={caixa} className="pv flex text-left text-[13px]" aria-hidden="true">
      <aside className="hidden w-52 shrink-0 border-r border-line p-4 md:block">
        <Logo size={20} />
        <p className="mt-2 mb-5 truncate text-[12px] text-muted">Distribuidora Fonte Azul</p>
        <ul className="space-y-0.5">
          {nav.map(([Icone, rotulo]) => (
            <li key={rotulo} className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 ${rotulo === "Painel" ? "bg-subtle font-medium text-fg" : "text-muted"}`}>
              <Icone size={15} strokeWidth={1.75} />
              {rotulo}
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 flex-1 p-5 sm:p-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] text-muted">Quinta-feira, 12 de novembro</p>
            <p className="text-[19px] font-semibold tracking-[-0.02em]">Painel do dia</p>
          </div>
          <span className="rounded-md bg-fg px-3 py-1.5 text-[12px] font-medium text-bg">Novo pedido</span>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface">
          <div className="p-4">
            <p className="text-[12px] text-muted">Vendido hoje</p>
            <LiveNumber value={vendido.cents} cents className="mt-1 text-[22px] font-semibold tracking-[-0.03em]" />
            <p className="mt-1 text-[12px] text-muted">
              {vendido.entregues} entregues · <span className="text-ok">+12% que ontem</span>
            </p>
          </div>
          <div className="p-4">
            <p className="text-[12px] text-muted">Dinheiro na rua</p>
            <LiveNumber value={naRua} cents className="mt-1 text-[22px] font-semibold tracking-[-0.03em]" />
            <p className="mt-1 text-[12px] text-muted">com 3 entregadores, a acertar</p>
          </div>
          <div className="p-4">
            <p className="text-[12px] text-muted">Fila agora</p>
            <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">
              <LiveNumber value={conta("aberto")} /> <span className="text-[14px] font-normal text-muted">aguardando</span>
            </p>
            <p className="mt-1 text-[12px] text-muted">
              <LiveNumber value={conta("em_rota")} /> em rota
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <p className="border-b border-line px-4 py-2.5 font-medium">Pedidos de hoje</p>
            <ul>
              {pedidos.map((p) => (
                <li key={p.n} className={`pv-linha flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 ${mudou === p.n ? "pv-mudou" : ""}`}>
                  <span className="num w-8 text-muted">#{p.n}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {p.cliente}
                    <span className="text-muted"> · {p.item}</span>
                  </span>
                  <span className="hidden w-14 text-muted sm:block">{p.quem ?? ""}</span>
                  {/* a troca de situação entra no mesmo lugar, desfocada e firmando */}
                  <span key={p.status} className="pv-troca w-24">
                    <StatusBadge status={p.status} />
                  </span>
                  <span className="num w-20 text-right font-medium">{formatBRL(p.cents)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden rounded-xl border border-line bg-surface lg:block">
            <p className="border-b border-line px-4 py-2.5 font-medium">Entregadores em turno</p>
            {[
              ["João Pereira", 27000],
              ["Carlos Mendes", 13500],
              ["Ana Souza", 5000],
            ].map(([nome, cents]) => (
              <div key={nome} className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-0">
                <span>{nome}</span>
                <span className="num font-medium">{formatBRL(cents as number)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
