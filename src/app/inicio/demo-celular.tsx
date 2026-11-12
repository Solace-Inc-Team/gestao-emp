"use client";

import { Collapse, Count, Phone, Stage, type Act } from "@/vendor/stageshow";
import { Cartao, pedido, type Fase } from "./demo-entrega";
import { brl, useEscuro } from "./palco";
import "./demo-celular.css";

// FIG. 03: o João toca em entreguei, desfaz dentro dos 5 segundos, toca de novo e deixa
// confirmar; o dinheiro que ele deve ter em mãos sobe. Toca uma vez e fica no resultado.

type S = { fase: Fase; resta: number; dinheiro: number };

const INICIO: S = { fase: "rota", resta: 5, dinheiro: 24800 };
// o pôster mostra o que o card promete: a contagem com o Desfazer à mão
const POSTER: S = { fase: "confirmando", resta: 4, dinheiro: 24800 };

async function contar(a: Act<S>, ate: number) {
  for (let r = 4; r >= ate; r--) {
    await a.wait(480);
    a.put({ resta: r });
  }
}

async function script(a: Act<S>) {
  await a.wait(900);
  await a.click({ at: "entregar", x: 0.7, y: 0.55 });
  a.put({ fase: "confirmando", resta: 5 });
  await contar(a, 4);
  await a.wait(300);
  await a.click({ at: "desfazer", x: 0.5, y: 0.55 });
  a.put({ fase: "rota", resta: 5 });
  await a.wait(1300);
  await a.click({ at: "entregar", x: 0.7, y: 0.55 });
  a.put({ fase: "confirmando", resta: 5 });
  await contar(a, 1);
  await a.wait(480);
  a.put((s) => ({ fase: "entregue", dinheiro: s.dinheiro + pedido(0).valor }));
  await a.wait(2600);
}

export function DemoCelular() {
  const dark = useEscuro();
  return (
    <Stage<S>
      width={360}
      height={570}
      initial={INICIO}
      poster={POSTER}
      script={script}
      play="once"
      cursor={{ at: { x: 320, y: 520 }, style: "touch" }}
      theme={dark ? "dark" : "light"}
      className="de de3 palco"
    >
      {(s) => (
        <Phone width={300} className="de-celular" time="10:41" dark={dark}>
          <div className="de-app">
            <span className="de-app__ola">Olá, João</span>
            <div className="de3-caixa">
              <span>Dinheiro que você deve ter agora</span>
              <Count value={s.dinheiro} format={brl} duration={900} className="de3-caixa__valor" />
            </div>
            <span className="de-app__titulo">Suas entregas</span>
            {[0, 1, 2].map((i) => (
              // o primeiro sai quando confirma e o próximo pedido chega embaixo
              <Collapse key={i} open={i === 0 ? s.fase !== "entregue" : i === 1 || s.fase === "entregue"} reveal="drop">
                <Cartao p={pedido(i)} fase={i === 0 ? s.fase : "rota"} resta={s.resta} topo={i === 0} />
              </Collapse>
            ))}
          </div>
        </Phone>
      )}
    </Stage>
  );
}
