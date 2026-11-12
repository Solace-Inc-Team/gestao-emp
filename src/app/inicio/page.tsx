import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, FileSpreadsheet, KeyRound, WifiOff } from "lucide-react";
import { Logo } from "@/components/logo";
import { InView } from "@/components/in-view";
import { LiveNumber } from "@/components/live-number";
import { Spotlight } from "@/components/spotlight";
import painel from "../../../public/telas/painel.png";
import painelEscuro from "../../../public/telas/painel-escuro.png";
import entregador from "../../../public/telas/entregador.png";
import portal from "../../../public/telas/portal.png";

export const metadata = {
  title: { absolute: "Depósito: gestão para revendas de água e gás" },
  description:
    "Pedidos, entregas, estoque de cheios e vazios e o acerto de caixa de cada entregador, num sistema feito para a rotina da distribuidora.",
};

const passos = [
  { n: "01", t: "Pedido", d: "Chega pelo WhatsApp, telefone, balcão ou pelo link da loja. O preço vem do cadastro." },
  { n: "02", t: "Rota", d: "O atendente escolhe o entregador. O botijão já sai reservado do estoque." },
  { n: "03", t: "Entrega", d: "O entregador confirma no celular, até sem sinal. Parcial e ocorrência também." },
  { n: "04", t: "Acerto", d: "No fim do turno o caixa conta o dinheiro. Diferença fica pendente até o dono decidir." },
];

const titulo = "Do pedido ao acerto, sem conta de cabeça.".split(" ");
const atraso = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

// avisos de exemplo que passam ao lado do painel: a loja funcionando enquanto a pessoa lê
const feed = [
  { t: "Pedido #128 lançado", d: "Ana Ribeiro, 1× Gás P13", cor: "bg-warn" },
  { t: "Carlos saiu para entrega", d: "2 pedidos, Jd. Primavera", cor: "bg-accent" },
  { t: "Pix de R$ 28,00 conferido", d: "Pedido #126, Cláudia", cor: "bg-ok" },
  { t: "Acerto do João: sem diferença", d: "R$ 165,00 contados", cor: "bg-ok" },
];

// feixes de luz que correm pelas linhas da grade (colunas de 56 px)
const feixes = [
  { col: 3, dur: 7, atraso: 0 },
  { col: 9, dur: 9, atraso: 2.5 },
  { col: 14, dur: 8, atraso: 5 },
  { col: 20, dur: 10, atraso: 1.2 },
];

const estoque = [
  { p: "Gás P13", cheio: 42, vazio: 18, rua: 6 },
  { p: "Galão 20L", cheio: 75, vazio: 31, rua: 12 },
  { p: "Gás P45", cheio: 8, vazio: 3, rua: 0 },
];

const extras = [
  { icon: WifiOff, t: "Funciona sem internet", d: "A confirmação da entrega fica guardada e sobe quando o sinal volta." },
  { icon: KeyRound, t: "Senha de novo no que não volta", d: "Estorno, inventário e ajuste pedem confirmação de quem está logado." },
  { icon: Building2, t: "Cada empresa isolada", d: "Filtro em toda consulta e Row-Level Security no Postgres por baixo." },
  { icon: FileSpreadsheet, t: "Os dados são seus", d: "Relatórios por dia, entregador e produto, e exportação em planilha." },
];

export default function Inicio() {
  return (
    <div className="overflow-x-clip">
      <header className="site-header sticky top-0 z-20 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Depósito, início">
            <Logo />
          </Link>
          <nav className="flex items-center gap-6 text-[13px] text-muted">
            <a href="#como-funciona" className="hidden hover:text-fg sm:inline">Como funciona</a>
            <a href="#recursos" className="hidden hover:text-fg sm:inline">Recursos</a>
            <Link href="/login" className="btn px-3 text-[13px] sm:h-8">Entrar</Link>
          </nav>
        </div>
      </header>

      <main>
        <Spotlight as="section" className="hero relative isolate">
          {/* fundo vivo: aurora de água (azul) e chama (âmbar), grade com feixes, holofote no cursor e granulado */}
          <div aria-hidden="true" className="hero-bg pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="aurora aurora-agua" />
            <div className="aurora aurora-chama" />
            <div className="aurora aurora-ceu" />
            <div className="hero-grid absolute inset-0" />
            <div className="hero-grid-lit absolute inset-0" />
            {feixes.map((f) => (
              <span
                key={f.col}
                className="beam"
                style={{ left: `calc(50% + ${(f.col - 12) * 56}px)`, animationDuration: `${f.dur}s`, animationDelay: `${f.atraso}s` }}
              />
            ))}
            <div className="noise absolute inset-0" />
          </div>
          <div className="mx-auto max-w-6xl px-4 pt-20 text-center sm:px-6 sm:pt-28">
            <p style={atraso(0)} className="hero-in inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-muted">
              <span className="size-1.5 rounded-full bg-ok" />
              Para revendas de água e gás
            </p>
            <h1 className="mx-auto mt-6 max-w-[15ch] text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-[4.25rem]">
              {/* cada palavra entra sozinha; o espaço fica fora para não ser comido pelo inline-block */}
              {titulo.map((w, i) => (
                <Fragment key={i}>
                  <span style={atraso(60 + i * 35)} className="hero-word">
                    {w}
                  </span>{" "}
                </Fragment>
              ))}
            </h1>
            <p style={atraso(300)} className="hero-in mx-auto mt-5 max-w-[34rem] text-[16px] leading-relaxed text-muted sm:text-[17px]">
              Pedidos, entregas, botijões cheios e vazios e o dinheiro de cada entregador, registrados com quem fez e quando.
            </p>
            <div style={atraso(380)} className="hero-in mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/login" className="btn btn-primary btn-shine h-11 px-5 text-[15px]">
                Entrar no sistema <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a href="#como-funciona" className="btn h-11 px-5 text-[15px]">Ver como funciona</a>
            </div>
          </div>

          <div style={atraso(480)} className="hero-in hero-stage relative mx-auto mt-16 max-w-6xl px-4 sm:mt-20 sm:px-6">
            <ul aria-hidden="true" className="feed absolute top-56 -right-10 z-10 hidden w-72 xl:block">
              {feed.map((n, i) => (
                <li key={n.t} style={{ animationDelay: `${1.2 + i * 3}s` }} className="feed-item">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.cor}`} />
                  <span>
                    <span className="block text-[13px] font-medium">{n.t}</span>
                    <span className="block text-[12px] text-muted">{n.d}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="hero-tilt hero-shot rounded-2xl border border-line bg-surface p-1.5 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.35)] sm:p-2">
              {[
                { src: painel, cls: "dark:hidden" },
                { src: painelEscuro, cls: "hidden dark:block" },
              ].map(({ src, cls }) => (
                <Image
                  key={cls}
                  src={src}
                  alt="Painel do dia: vendido hoje, pedidos em rota, Pix a conferir e acertos pendentes"
                  priority
                  sizes="(min-width: 1152px) 1120px, 100vw"
                  className={`h-auto w-full rounded-xl border border-line ${cls}`}
                />
              ))}
            </div>
          </div>
        </Spotlight>

        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
          <p className="text-[13px] font-medium text-accent">Como funciona</p>
          <h2 className="reveal mt-2 max-w-[22ch] text-[2rem] leading-tight font-semibold tracking-[-0.035em] sm:text-[2.5rem]">
            O caminho de um botijão, do telefone até o caixa.
          </h2>
          <InView className="steps relative mt-12">
            {/* linha que corre por cima dos passos quando eles aparecem */}
            <div aria-hidden="true" className="steps-line absolute inset-x-0 -top-px z-10 h-0.5 rounded-full bg-accent" />
            <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {passos.map((s, i) => (
                <li key={s.n} style={atraso(i * 160)} className="step bg-surface p-6">
                  <span className="step-n num text-[13px] text-muted">{s.n}</span>
                  <h3 className="mt-8 text-[17px] font-semibold tracking-tight">{s.t}</h3>
                  <p className="mt-2 text-muted">{s.d}</p>
                </li>
              ))}
            </ol>
          </InView>
        </section>

        <section id="recursos" className="recursos relative isolate scroll-mt-20 border-y border-line bg-surface/60">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
            <p className="text-[13px] font-medium text-accent">Recursos</p>
            <h2 className="reveal mt-2 max-w-[24ch] text-[2rem] leading-tight font-semibold tracking-[-0.035em] sm:text-[2.5rem]">
              Feito em cima do que dá errado numa revenda.
            </h2>

            <Spotlight className="mt-12 grid gap-4 lg:grid-cols-6">
              <article className="reveal glow-card panel flex flex-col p-6 sm:p-8 lg:col-span-3">
                <h3 className="text-[17px] font-semibold tracking-tight">Acerto que fecha no centavo</h3>
                <p className="mt-2 text-muted">
                  O sistema sabe quanto cada entregador deve ter em mãos. Pagamento misto, repasse no meio do dia e gasto
                  autorizado entram na conta.
                </p>
                <InView className="mt-8">
                  <dl className="receipt num rounded-xl border border-line bg-bg p-5 text-[14px]">
                    <div style={atraso(0)} className="print flex justify-between py-1"><dt className="text-muted">Troco inicial</dt><dd>R$ 30,00</dd></div>
                    <div style={atraso(140)} className="print flex justify-between py-1"><dt className="text-muted">Recebido em dinheiro</dt><dd>R$ 385,00</dd></div>
                    <div style={atraso(280)} className="print flex justify-between py-1"><dt className="text-muted">Repasse ao caixa</dt><dd>− R$ 200,00</dd></div>
                    <div style={atraso(420)} className="print flex justify-between py-1"><dt className="text-muted">Gasolina autorizada</dt><dd>− R$ 50,00</dd></div>
                    <div style={atraso(560)} className="print mt-2 flex justify-between border-t border-dashed border-line pt-3 font-semibold">
                      <dt>Deve apresentar</dt><dd><LiveNumber value={16500} cents fromZero="visible" /></dd>
                    </div>
                    <div style={atraso(700)} className="print flex items-center justify-between py-1">
                      <dt className="text-muted">Contado</dt>
                      <dd className="flex items-center gap-2">
                        R$ 165,00
                        <span style={atraso(1040)} className="stamp rounded-full bg-ok-soft px-2 py-0.5 text-[12px] font-medium text-ok">sem diferença</span>
                      </dd>
                    </div>
                  </dl>
                </InView>
              </article>

              <article className="reveal glow-card panel flex flex-col p-6 sm:p-8 lg:col-span-3">
                <h3 className="text-[17px] font-semibold tracking-tight">Estoque de retornáveis</h3>
                <p className="mt-2 text-muted">
                  Cheios, vazios e avariados, na loja e na rua. Saldo é a soma dos lançamentos; erro se corrige com estorno,
                  nunca apagando.
                </p>
                {/* números simples entrando linha a linha: dez contadores rolando juntos pesam na rolagem de celular fraco */}
                <InView className="mt-8">
                  <table className="num w-full overflow-hidden rounded-xl border border-line bg-bg text-[14px]">
                    <thead>
                      <tr className="text-left text-[12px] text-muted">
                        <th className="px-4 py-2.5 font-medium">Produto</th>
                        <th className="px-4 py-2.5 text-right font-medium">Cheios</th>
                        <th className="px-4 py-2.5 text-right font-medium">Vazios</th>
                        <th className="px-4 py-2.5 text-right font-medium">Na rua</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estoque.map((e, i) => (
                        <tr key={e.p} style={atraso(i * 140)} className="print border-t border-line">
                          <td className="px-4 py-2.5">{e.p}</td>
                          <td className="px-4 py-2.5 text-right">{e.cheio}</td>
                          <td className="px-4 py-2.5 text-right text-muted">{e.vazio}</td>
                          <td className="px-4 py-2.5 text-right text-muted">{e.rua}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </InView>
              </article>

              <article className="reveal glow-card panel overflow-hidden lg:col-span-4">
                <div className="grid h-full sm:grid-cols-2">
                  <div className="p-6 sm:p-8">
                    <h3 className="text-[17px] font-semibold tracking-tight">No celular do entregador</h3>
                    <p className="mt-2 text-muted">
                      Só as entregas dele, quanto deve ter em dinheiro e um botão grande pra confirmar, com 5 segundos pra
                      desfazer.
                    </p>
                  </div>
                  <div className="relative min-h-72 bg-subtle">
                    <Image
                      src={entregador}
                      alt="Tela do entregador no celular"
                      sizes="(min-width: 640px) 260px, 70vw"
                      className="float absolute top-6 left-1/2 w-[62%] max-w-[240px] -translate-x-1/2 rounded-[1.75rem] border-[6px] border-fg/90 shadow-xl"
                    />
                  </div>
                </div>
              </article>

              <article className="reveal glow-card panel overflow-hidden lg:col-span-2">
                <div className="p-6 sm:p-8">
                  <h3 className="text-[17px] font-semibold tracking-tight">Pedido pelo link da loja</h3>
                  <p className="mt-2 text-muted">O cliente pede sozinho e já recebe o QR do Pix.</p>
                </div>
                <div className="relative h-72 bg-subtle">
                  <Image
                    src={portal}
                    alt="Pedido pelo site, no celular do cliente"
                    sizes="240px"
                    style={atraso(-2500)}
                    className="float absolute top-6 left-1/2 w-[62%] max-w-[220px] -translate-x-1/2 rounded-[1.75rem] border-[6px] border-fg/90 shadow-xl"
                  />
                </div>
              </article>
            </Spotlight>

            <ul className="mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {extras.map(({ icon: Icon, t, d }) => (
                <li key={t}>
                  <Icon className="size-5 text-muted" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold">{t}</h3>
                  <p className="mt-1 text-muted">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6 sm:py-32">
          <div className="cta-band relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-20 text-center sm:py-24">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
              <div className="aurora aurora-agua" />
              <div className="aurora aurora-chama" />
              <div className="noise absolute inset-0" />
            </div>
            <h2 className="reveal mx-auto max-w-[20ch] text-[2rem] leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-[2.75rem]">
              Quatro perfis, uma conta que bate.
            </h2>
            <p className="mx-auto mt-4 max-w-[32rem] text-white/70">
              Dono, caixa, atendente e entregador, cada um vendo só o que é seu.
            </p>
            <Link href="/login" className="btn btn-shine mt-8 h-11 border-white bg-white px-5 text-[15px] text-black hover:bg-white/90">
              Entrar no sistema <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-muted sm:px-6">
          <span>Depósito, um produto Solace.</span>
          <nav className="flex gap-5">
            <Link href="/termos" className="hover:text-fg">Termos de uso</Link>
            <Link href="/privacidade" className="hover:text-fg">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
