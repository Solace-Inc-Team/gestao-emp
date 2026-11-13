"use client";

import QRCode from "qrcode";
import { Button, Check, Count, Phone, Segmented, Stage, type Act } from "@/vendor/stageshow";
import { pixPayload } from "@/lib/pix";
import { brl, useEscuro } from "./palco";
import "./demo-portal.css";

// FIG. 04: o cliente abre o link da loja, põe um gás, escolhe Pix e pede; volta o QR na hora.
// Toca uma vez quando o card aparece e fica no QR.

type S = { gas: number; pagamento: number; enviando: boolean; feito: boolean };

const INICIO: S = { gas: 0, pagamento: 0, enviando: false, feito: false };
const FIM: S = { gas: 1, pagamento: 1, enviando: false, feito: true };

// um código Pix de verdade, montado como o sistema monta; a chave é aleatória
const PIX = pixPayload({ key: "7d9f0335-8dcc-4054-9bf9-0dbd61d36906", name: "Fonte Azul", city: "Campinas", amountCents: 11500, txid: "PEDIDO62" });
const QR = QRCode.create(PIX, { errorCorrectionLevel: "M" }).modules;

function Qr() {
  const n = QR.size;
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (QR.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} className="dp-qr" aria-hidden="true" shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <path d={d} fill="#111" />
    </svg>
  );
}

async function script(a: Act<S>) {
  await a.wait(900);
  await a.click({ at: "mais", x: 0.5, y: 0.5 });
  a.put({ gas: 1 });
  await a.wait(900);
  await a.click({ at: "pix", x: 0.5, y: 0.5 });
  a.put({ pagamento: 1 });
  await a.wait(900);
  await a.click({ at: "pedir", x: 0.62, y: 0.55 });
  a.put({ enviando: true });
  await a.wait(800);
  a.put({ enviando: false, feito: true });
  await a.wait(2400);
}

/** `escuro` força o tema escuro, para a página inicial que é sempre escura. */
export function DemoPortal({ escuro = false }: { escuro?: boolean }) {
  const dark = useEscuro() || escuro;
  return (
    <Stage<S>
      width={360}
      height={400}
      initial={INICIO}
      poster={FIM}
      script={script}
      play="once"
      cursor={{ at: { x: 300, y: 340 }, style: "touch" }}
      theme={dark ? "dark" : "light"}
      className="dp palco"
    >
      {(s) => (
        <Phone width={300} className="dp-celular" time="9:41" dark={dark}>
          <div className="dp-app">
            <span className="dp-sobre">Pedido pelo site</span>
            <span className="dp-loja">Fonte Azul</span>

            <div className="dp-tela" data-on={!s.feito || undefined}>
              <div className="dp-card">
                <div className="dp-produto">
                  <span className="dp-produto__nome">
                    Gás P13
                    <small>{brl(11500)}</small>
                  </span>
                  <span className="dp-qtd">
                    <span className="dp-qtd__b">−</span>
                    <Count value={s.gas} duration={400} className="dp-qtd__n" />
                    <span className="dp-qtd__b" data-target="mais">+</span>
                  </span>
                </div>
              </div>

              <span className="dp-titulo">Pagamento</span>
              <Segmented items={["Dinheiro", "Pix", "Cartão"]} value={s.pagamento} targets={[undefined, "pix", undefined]} className="dp-pagamento" />

              <div className="dp-card dp-total">
                <span className="dp-total__linha">
                  <b>Total</b>
                  <span className="dp-total__valor">
                    R$
                    <Count value={s.gas * 11500} format={(c) => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} duration={700} className="dp-total__digitos" />
                  </span>
                </span>
                <Button variant="primary" size="large" className="dp-pedir" data-target="pedir">
                  {s.enviando ? "Enviando…" : "Fazer pedido"}
                </Button>
              </div>
            </div>

            <div className="dp-tela dp-feito" data-on={s.feito || undefined}>
              <div className="dp-card">
                <span className="dp-recebido">
                  <Check on={s.feito} size={22} /> Pedido #62 recebido
                </span>
                <span className="dp-linha">1× Gás P13, total de {brl(11500)}</span>
                <span className="dp-pix">Pague com Pix</span>
                <Qr />
                <Button size="large" className="dp-copiar">Copiar código Pix</Button>
              </div>
            </div>
          </div>
        </Phone>
      )}
    </Stage>
  );
}
