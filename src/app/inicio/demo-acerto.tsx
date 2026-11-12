"use client";

import { Bar, Button, Check, Connector, Field, Stage, States, Window, type Act } from "@/vendor/stageshow";
import { brl, useEscuro } from "./palco";
import "./demo-acerto.css";

// FIG. 01: o caixa conta o dinheiro do João, digita, o sistema diz que bateu e o acerto fecha.
// Toca uma vez quando o card aparece e fica no resultado, que é o que a maioria vê.

type S = { contado: string; foco: boolean; bateu: boolean; fechado: boolean };

const INICIO: S = { contado: "", foco: false, bateu: false, fechado: false };
const FIM: S = { contado: "165,00", foco: false, bateu: true, fechado: true };

const CONTA: [string, number][] = [
  ["Troco inicial", 3000],
  ["Vendas em dinheiro", 38500],
  ["Já repassou", -20000],
  ["Gastos autorizados", -5000],
];

async function script(a: Act<S>) {
  await a.wait(900);
  await a.click({ at: "contado", x: 0.8, y: 0.55 });
  a.put({ foco: true });
  await a.wait(250);
  await a.type("contado", "165,00", { interval: 110 });
  await a.wait(300);
  a.put({ bateu: true });
  await a.wait(1300);
  await a.click({ at: "fechar", x: 0.78, y: 0.6 });
  a.put({ foco: false });
  await a.wait(700);
  a.put({ fechado: true });
  await a.move({ at: "fechar", x: 0.9, y: 2.2 });
  await a.wait(2000);
}

export function DemoAcerto() {
  const dark = useEscuro();
  return (
    <Stage<S>
      width={560}
      height={300}
      compact={{ below: 480, width: 358, height: 310 }}
      initial={INICIO}
      poster={FIM}
      script={script}
      play="once"
      cursor={{ at: { wide: { x: 520, y: 270 }, compact: { x: 330, y: 290 } } }}
      theme={dark ? "dark" : "light"}
      className="da palco"
    >
      {(s, rect, layout) => {
        // a linha liga o "bateu" ao valor que ele confere; no estreito os dois ficam empilhados e ela sai
        const total = rect("total");
        const bateu = rect("bateu");
        return (
          <>
            <Window title="Acerto de João" className="da-janela" lights="grey">
              <div className="da-corpo">
                <dl className="da-conta">
                  {CONTA.map(([rotulo, v]) => (
                    <div key={rotulo} className="da-termo">
                      <dt>{rotulo}</dt>
                      <dd>{v < 0 ? `− ${brl(-v)}` : brl(v)}</dd>
                    </div>
                  ))}
                  <div className="da-termo da-termo--total">
                    <dt>Deve apresentar</dt>
                    <dd data-target="total">{brl(16500)}</dd>
                  </div>
                </dl>

                <div className="da-form">
                  <Field
                    label="Dinheiro contado"
                    value={s.contado}
                    placeholder="0,00"
                    focused={s.foco}
                    leading={<span className="da-rs">R$</span>}
                    box={{ "data-target": "contado", "data-cursor": "ibeam" }}
                    className="da-campo"
                  />
                  <div className="da-faixa">
                    <States
                      align="start"
                      value={s.bateu ? "bateu" : "dica"}
                      states={{
                        dica: <span className="da-dica">Conte na frente do entregador</span>,
                        bateu: (
                          <span className="da-bateu" data-target="bateu">
                            <Check on={s.bateu} size={16} /> bateu, sem diferença
                          </span>
                        ),
                      }}
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="large"
                    className="da-fechar"
                    data-target="fechar"
                    icon={s.fechado ? <Check on size={16} /> : undefined}
                  >
                    {s.fechado ? "Acerto fechado" : "Fechar acerto"}
                  </Button>
                </div>

                <div className="da-lancamentos" aria-hidden="true">
                  <Bar w={96} h={7} tone={3} />
                  {[132, 104, 148].map((w, i) => (
                    <div key={i} className="da-lancamento">
                      <Bar w={w} h={6} tone={2} />
                      <Bar w={52} h={6} tone={1} />
                    </div>
                  ))}
                </div>
              </div>
            </Window>
            {layout === "wide" && total && bateu && (
              <Connector
                from={{ x: bateu.x - 6, y: bateu.y + bateu.height / 2 }}
                to={{ x: total.x + total.width + 6, y: total.y + total.height / 2 }}
                show={s.bateu}
                className="da-confere"
              />
            )}
          </>
        );
      }}
    </Stage>
  );
}
