import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, MonitorSmartphone, Users, WifiOff } from "lucide-react";
import { InView } from "@/components/in-view";
import { TemaBotao } from "@/components/tema-botao";
import { Logo } from "@/components/logo";
import { PainelVivo } from "../painel-vivo";

// Proposta de topo novo, para comparar com /inicio antes de trocar. O protagonista é o produto:
// título curto, uma linha de apoio e o Painel de verdade, grande, que endireita conforme a página rola.
export const metadata = { title: "Depósito (topo novo)", robots: { index: false } };

const titulo = ["Onde está cada casco.", "Quanto cada entregador te deve."].map((l) => l.split(" "));
const atraso = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
const fatos = [
  { icone: WifiOff, t: "Funciona sem internet", d: "A entrega confirmada no celular sobe sozinha quando o sinal volta." },
  { icone: MonitorSmartphone, t: "Nada para instalar", d: "Abre no navegador do computador e do celular." },
  { icone: Users, t: "4 perfis de acesso", d: "Dono, caixa, atendente e entregador, cada um no seu." },
  { icone: BadgeCheck, t: "Acerto no centavo", d: "O sistema já sabe quanto cada entregador tem que apresentar." },
];

export default function InicioNova() {
  return (
    <div className="overflow-x-clip">
      <header className="site-header sticky top-0 z-20 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Depósito, início" className="alvo">
            <Logo />
          </Link>
          <nav className="flex items-center gap-6 text-[13px] text-muted">
            <TemaBotao className="size-9 sm:size-8" />
            <Link href="/login" className="btn px-3 text-[13px] sm:h-8">Entrar</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="topo-novo relative isolate pt-20 sm:pt-28">
          {/* atrás do título, só luz: um clarão da cor da marca vindo de cima, como de uma tela acesa */}
          <div aria-hidden="true" className="topo-luz absolute inset-0 -z-10" />
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <p style={atraso(0)} className="hero-in inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-muted">
              <span className="size-1.5 rounded-full bg-ok" />
              Para revendas de água e gás
            </p>
            <h1 className="mx-auto mt-6 max-w-[16ch] text-[2.5rem] leading-[1.04] font-semibold tracking-[-0.045em] text-balance sm:max-w-none sm:text-[3.25rem] lg:text-[4.25rem]">
              {titulo.map((linha, l) => (
                <span key={l} className="block">
                  {linha.map((w, i) => (
                    <Fragment key={i}>
                      <span style={atraso(60 + (l * titulo[0].length + i) * 35)} className="hero-word">
                        {w}
                      </span>{" "}
                    </Fragment>
                  ))}
                </span>
              ))}
            </h1>
            <p style={atraso(320)} className="hero-in mx-auto mt-5 text-[16px] text-muted sm:text-[18px]">
              Pedido, entrega, cascos e acerto de caixa num lugar só.
            </p>
            <div style={atraso(400)} className="hero-in mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/login" className="btn btn-primary h-11 px-5 text-[15px]">
                Entrar no sistema <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/inicio#dia" className="btn h-11 px-5 text-[15px]">Ver como funciona</Link>
            </div>
          </div>

          {/* o produto: grande, sem moldura, com luz atrás; deitado no começo, endireita ao rolar */}
          <div style={atraso(520)} className="hero-in topo-palco relative mx-auto mt-16 max-w-[72rem] px-4 sm:mt-20 sm:px-6">
            <div className="topo-inclina">
              <div className="topo-tela overflow-hidden rounded-2xl border border-line bg-bg">
                <div className="min-w-[56rem]">
                  <PainelVivo />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* fatos curtos e verdadeiros no lugar de logos que ainda não temos */}
        <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <InView>
            <ul className="fatos grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {fatos.map(({ icone: Icone, t, d }, i) => (
                <li key={t} style={atraso(i * 90)} className="fato">
                  <Icone size={18} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
                  <p className="mt-3 text-[15px] font-semibold tracking-[-0.01em]">{t}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted">{d}</p>
                </li>
              ))}
            </ul>
          </InView>
        </section>

        <p className="py-16 text-center text-[13px] text-muted">
          Proposta só do topo. <Link href="/inicio" className="text-accent hover:underline">Ver a página atual</Link>
        </p>
      </main>
    </div>
  );
}
