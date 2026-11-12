"use client";

import { Badge, Bar, Button, Collapse, Count, Phone, Roll, Stage, States, Window, type Act } from "@/vendor/stageshow";
import { LayoutDashboard, MapPin, Package, Truck, Users, Wallet } from "lucide-react";
import { brl, useEscuro } from "./palco";
import "./demo-entrega.css";

// O hero da página: o entregador confirma no celular e o painel da loja muda sozinho.
// Roda como esteira: cada volta entrega um pedido e o próximo chega, então os valores
// nunca voltam para trás na frente de quem assiste. Fora da tela o palco reinicia.

type Pedido = { numero: number; cliente: string; rua: string; item: string; valor: number; pix: boolean; hora: string };

const BASE: Omit<Pedido, "numero" | "hora">[] = [
  { cliente: "Marta Ribeiro", rua: "Rua XV de Novembro, 300", item: "1× Gás P13", valor: 11500, pix: false },
  { cliente: "Bar do Zé", rua: "Av. Brasil, 1.240", item: "3× Galão 20L", valor: 4500, pix: true },
  { cliente: "Carlos Mendes", rua: "Rua das Acácias, 85", item: "1× Gás P13", valor: 11500, pix: false },
  { cliente: "Padaria Estrela", rua: "Rua Sete de Setembro, 42", item: "2× Galão 20L", valor: 3000, pix: false },
];

const pedido = (i: number): Pedido => {
  const b = BASE[((i % BASE.length) + BASE.length) % BASE.length];
  const min = 10 * 60 + 12 + i * 9;
  return { ...b, numero: 58 + i, hora: `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}` };
};

type Fase = "rota" | "confirmando" | "entregue";
type S = { atual: number; fase: Fase; resta: number; vendido: number; rua: number; entregues: number };

const INICIO: S = { atual: 0, fase: "rota", resta: 5, vendido: 106300, rua: 24800, entregues: 15 };
const DEPOIS: S = { ...INICIO, fase: "entregue", vendido: INICIO.vendido + 11500, rua: INICIO.rua + 11500, entregues: 16 };

const REPOUSO = { x: 930, y: 470 };

async function script(a: Act<S>) {
  for (;;) {
    await a.wait(1300);
    await a.click({ at: "entregar", x: 0.7, y: 0.55 });
    a.put({ fase: "confirmando", resta: 5 });
    // a contagem real é de 5s; aqui corre mais rápido para não cansar
    for (let r = 4; r >= 1; r--) {
      await a.wait(420);
      a.put({ resta: r });
    }
    await a.wait(500);
    a.put((s) => {
      const p = pedido(s.atual);
      return { fase: "entregue", vendido: s.vendido + p.valor, rua: s.rua + (p.pix ? 0 : p.valor), entregues: s.entregues + 1 };
    });
    await a.move(REPOUSO);
    await a.wait(2600);
    a.put((s) => ({ atual: s.atual + 1, fase: "rota", resta: 5 }));
    await a.wait(700);
  }
}

const NAV = [
  { icon: LayoutDashboard, nome: "Painel" },
  { icon: Package, w: 52 },
  { icon: Truck, w: 46 },
  { icon: Wallet, w: 60 },
  { icon: Users, w: 40 },
];

function Status({ entregue }: { entregue: boolean }) {
  return (
    <Badge tone={entregue ? "success" : "accent"} className="de-status">
      <Roll variant="fade">{entregue ? "Entregue" : "Em rota"}</Roll>
    </Badge>
  );
}

function Cartao({ p, s, topo }: { p: Pedido; s: S; topo: boolean }) {
  const fase: Fase = topo ? s.fase : "rota";
  return (
    <div className="de-card">
      <div className="de-card__head">
        <span className="de-card__cliente">{p.cliente}</span>
        <span className="de-card__num">#{p.numero}</span>
      </div>
      <span className="de-card__rua">
        <MapPin size={16} strokeWidth={1.9} aria-hidden="true" />
        {p.rua}
      </span>
      <span className="de-card__item">{p.item}</span>
      <div className="de-card__cobrar">
        <span>Cobrar {p.pix ? "no Pix" : "em dinheiro"}</span>
        <b>{brl(p.valor)}</b>
      </div>
      <States
        className="de-card__acao"
        align="start"
        value={fase === "rota" ? "rota" : "confirmando"}
        states={{
          rota: (
            <Button variant="primary" size="large" className="de-entregar" data-target={topo ? "entregar" : undefined}>
              {p.pix ? "Entreguei, Pix pago" : "Entreguei e recebi"}
            </Button>
          ),
          confirmando: (
            <span className="de-confirma">
              <span className="de-confirma__linha">
                <span>
                  Confirmando em <Roll>{String(s.resta)}</Roll>s…
                </span>
                <Button size="large">Desfazer</Button>
              </span>
              <span className="de-confirma__barra" data-on={fase !== "rota" || undefined} />
            </span>
          ),
        }}
      />
    </div>
  );
}

export function DemoEntrega() {
  const dark = useEscuro();
  return (
    <Stage<S>
      width={1040}
      height={540}
      compact={{ below: 640, width: 358, height: 560 }}
      initial={INICIO}
      poster={DEPOIS}
      script={script}
      cursor={{ at: { wide: REPOUSO, compact: { x: 330, y: 540 } }, style: "touch" }}
      theme={dark ? "dark" : "light"}
      className="de palco"
    >
      {(s, _rect, layout) => {
        const linhas = [];
        // da mais nova para a mais antiga; a de cima ainda não chegou e abre quando chega
        for (let i = s.atual + 2; i >= s.atual - 3; i--) linhas.push(i);
        const cartoes = [s.atual, s.atual + 1, s.atual + 2, s.atual + 3];
        return (
          <>
            <Window
              className="de-janela"
              sidebar={
                layout === "wide" ? <nav className="de-nav">
                  <span className="de-marca">Depósito</span>
                  {NAV.map(({ icon: I, nome, w }, i) => (
                    <span key={i} className="de-nav__item" data-on={i === 0 || undefined}>
                      <I size={16} strokeWidth={1.9} aria-hidden="true" />
                      {nome ?? <Bar w={w!} h={6} tone={2} />}
                    </span>
                  ))}
                </nav> : undefined
              }
              sidebarWidth={176}
              title="Painel do dia"
            >
              <div className="de-main">
                <div className="de-numeros">
                  <div className="de-numero">
                    <span className="de-rotulo">Vendido hoje</span>
                    <Count className="de-valor" value={s.vendido} format={brl} duration={900} />
                    <span className="de-sub">
                      <Count value={s.entregues} duration={600} /> pedidos entregues
                    </span>
                  </div>
                  <div className="de-numero">
                    <span className="de-rotulo">Dinheiro na rua</span>
                    <Count className="de-valor" value={s.rua} format={brl} duration={900} />
                    <span className="de-sub">com 3 entregadores, a acertar</span>
                  </div>
                </div>
                <div className="de-colunas">
                  <div className="de-lista">
                    <div className="de-lista__topo"><span>Pedidos de hoje</span></div>
                    {linhas.map((i) => {
                      const p = pedido(i);
                      const entregue = i < s.atual || (i === s.atual && s.fase === "entregue");
                      return (
                        <Collapse key={p.numero} open={i <= s.atual + 1} reveal="drop">
                          <div className="de-linha" data-foco={i === s.atual || undefined}>
                            <span className="de-linha__num">#{p.numero}</span>
                            <span className="de-linha__quem">
                              <span>{p.cliente}</span>
                              <small>
                                {p.hora}, João
                              </small>
                            </span>
                            <Status entregue={entregue} />
                            <span className="de-linha__valor">{brl(p.valor)}</span>
                          </div>
                        </Collapse>
                      );
                    })}
                  </div>
                  <div className="de-lado" aria-hidden="true">
                    <Bar w={120} h={7} tone={3} />
                    {[72, 56, 80].map((w, i) => (
                      <div key={i} className="de-lado__linha">
                        <Bar w={w} h={6} tone={2} />
                        <Bar w={44} h={6} tone={1} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Window>

            <Phone width={layout === "compact" ? 300 : 292} className="de-celular" time="10:41" dark={dark}>
              <div className="de-app">
                <span className="de-app__ola">Olá, João</span>
                <span className="de-app__titulo">Suas entregas</span>
                {cartoes.map((i, k) => {
                  const p = pedido(i);
                  const fica = !(k === 0 && s.fase === "entregue");
                  return (
                    <Collapse key={p.numero} open={k === 3 ? s.fase === "entregue" : fica} reveal="drop">
                      <Cartao p={p} s={s} topo={k === 0} />
                    </Collapse>
                  );
                })}
              </div>
            </Phone>
          </>
        );
      }}
    </Stage>
  );
}
