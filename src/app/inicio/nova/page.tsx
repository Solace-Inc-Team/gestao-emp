import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, MessageCircle, MonitorSmartphone, Users, WifiOff } from "lucide-react";
import { TemaBotao } from "@/components/tema-botao";
import { StatusSistema } from "@/components/status-sistema";
import { Logo } from "@/components/logo";
import { InView } from "@/components/in-view";
import { NivelVasilhame } from "@/components/nivel-vasilhame";
import { PainelVivo } from "../painel-vivo";
import { DemoAcerto } from "../demo-acerto";
import { DemoEntrega } from "../demo-entrega";
import { DemoPortal } from "../demo-portal";
import { DadosSeus, EmpresaIsolada, SenhaDeNovo } from "../diagramas";
import { PRECO, WHATSAPP, linkWhatsApp } from "../contato";
import { LuzCursor } from "../luz-cursor";

// Proposta da página inteira no padrão novo, para comparar com /inicio antes de trocar.
// Ritmo de escala variada: topo com o produto, dois capítulos grandes, um mosaico de detalhes,
// preço e perguntas, e um fechamento curto. Uma ideia visual só: tela do produto e luz.
export const metadata = { title: "Depósito (página nova)", robots: { index: false } };

const titulo = ["Onde está cada casco.", "Quanto cada entregador te deve."].map((l) => l.split(" "));
const atraso = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
const temZap = WHATSAPP !== "";
const zap = linkWhatsApp("Olá! Quero conhecer o Depósito para a minha revenda.");

const fatos = [
  { icone: WifiOff, t: "Funciona sem internet", d: "A entrega confirmada no celular sobe sozinha quando o sinal volta." },
  { icone: MonitorSmartphone, t: "Nada para instalar", d: "Abre no navegador do computador e do celular." },
  { icone: Users, t: "4 perfis de acesso", d: "Dono, caixa, atendente e entregador, cada um no seu." },
  { icone: BadgeCheck, t: "Acerto no centavo", d: "O sistema já sabe quanto cada entregador tem que apresentar." },
];

const perguntas = [
  ["Precisa instalar alguma coisa?", "Não. O Depósito abre no navegador do computador e do celular. No celular do entregador dá para pôr um ícone na tela inicial, como um aplicativo."],
  ["Emite nota fiscal?", "Ainda não. O Depósito cuida da operação: pedido, entrega, estoque e caixa. A nota continua no emissor que você já usa."],
  ["E se o celular do entregador ficar sem internet?", "Ele confirma a entrega mesmo assim. A confirmação fica guardada no aparelho e é enviada sozinha quando o sinal volta, sem duplicar."],
  ["O cliente consegue pedir sozinho?", "Sim. Cada loja tem um link de pedido. O pedido cai na fila com o selo do site e, se for Pix, o cliente já recebe o QR para pagar."],
  ["Quem trabalha comigo vê tudo?", "Não. São quatro perfis, dono, caixa, atendente e entregador, e cada um vê só o que é seu."],
  ["Se eu quiser sair, levo meus dados?", "Sim. O dono baixa todos os dados da empresa em planilhas, num arquivo só, quando quiser."],
];

function BotaoContato({ className = "" }: { className?: string }) {
  return temZap ? (
    <a href={zap} target="_blank" rel="noopener noreferrer" className={`btn btn-primary h-11 px-5 text-[15px] ${className}`}>
      <MessageCircle className="size-4" aria-hidden="true" /> Conversar no WhatsApp
    </a>
  ) : (
    <Link href="/login" className={`btn btn-primary h-11 px-5 text-[15px] ${className}`}>
      Entrar no sistema <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

/** Cabeçalho de capítulo: rótulo pequeno, frase grande e uma linha de apoio. */
function Capitulo({ rotulo, titulo, apoio, centro = false, tom = "text-accent" }: { rotulo: string; titulo: string; apoio: string; centro?: boolean; tom?: string }) {
  return (
    <div className={centro ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className={`text-[13px] font-medium ${tom}`}>{rotulo}</p>
      <h2 className="reveal mt-3 text-[2rem] leading-[1.08] font-semibold tracking-[-0.04em] text-balance sm:text-[2.75rem]">{titulo}</h2>
      <p className="mt-4 text-[16px] leading-relaxed text-muted sm:text-[17px]">{apoio}</p>
    </div>
  );
}

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
              <BotaoContato />
              <a href="#rua" className="btn h-11 px-5 text-[15px]">Ver como funciona</a>
            </div>
          </div>
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

        {/* capítulo 1, o maior: a entrega acontecendo nas duas pontas, celular e loja. É a virada da página:
            uma faixa sempre escura, de ponta a ponta, com a demonstração acesa no meio; o rótulo vem no âmbar do gás */}
        <section id="rua" className="faixa-escura mt-32 scroll-mt-14 border-y border-line py-28 sm:mt-44 sm:py-36">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Capitulo
            tom="text-chama"
            rotulo="Na rua"
            titulo="O entregador confirma. A loja vê na hora."
            apoio="Cada entrega com dono, do balcão até a porta. O vendido do dia sobe sozinho, até com o celular sem sinal."
          />
          <div
            role="img"
            aria-label="O entregador toca em Entreguei e recebi no celular, e no painel da loja o pedido vira Entregue e o vendido do dia sobe"
            className="topo-palco relative mt-14"
          >
            <DemoEntrega escuro />
          </div>
          </div>
        </section>

        {/* capítulo 2: o fim do dia, com o texto do outro lado para o ritmo não repetir */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-32 sm:px-6 sm:pt-44 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div
            role="img"
            aria-label="Acerto do João: deve apresentar R$ 165,00, o caixa digita 165,00, o sistema mostra bateu, sem diferença, e o acerto é fechado"
            className="overflow-hidden rounded-2xl border border-line bg-subtle"
          >
            <DemoAcerto />
          </div>
          <div className="order-first lg:order-none">
            <Capitulo
              rotulo="No fim do dia"
              titulo="A conta do entregador já vem pronta."
              apoio="Troco, vendas em dinheiro, repasses e gastos entram sozinhos. O caixa conta, e fecha no centavo ou a diferença fica registrada até o dono decidir."
            />
          </div>
        </section>

        {/* o número que o dono quer ver no fim do dia, em tamanho de cartaz */}
        <section className="mx-auto max-w-6xl px-4 pt-32 text-center sm:px-6 sm:pt-44">
          <p className="reveal num text-[clamp(4.5rem,15vw,10.5rem)] leading-none font-semibold tracking-[-0.06em]">R$ 0,00</p>
          <p className="reveal mt-5 text-[clamp(1.375rem,3vw,2.25rem)] font-semibold tracking-[-0.03em] text-muted">de diferença quando a conta fecha.</p>
        </section>

        {/* mosaico: os detalhes em peças menores, cada uma com a sua prova */}
        <section className="mx-auto max-w-6xl px-4 pt-32 sm:px-6 sm:pt-44">
          <Capitulo centro rotulo="Os detalhes" titulo="Feito em cima do que dá errado numa revenda." apoio="O que não aparece no dia bom e salva o dia ruim." />
          <LuzCursor>
          <InView className="mt-14 grid gap-4 lg:grid-cols-3">
            <article className="bento lg:row-span-2">
              <h3 className="text-[17px] font-semibold tracking-tight">Pedido pelo link, com Pix</h3>
              <p className="mt-1.5 text-muted">O cliente pede sozinho e já recebe o QR para pagar.</p>
              <div
                role="img"
                aria-label="No celular, o cliente põe um Gás P13, escolhe Pix e faz o pedido; aparece Pedido #62 recebido com o QR do Pix"
                className="-mx-6 -mb-6 mt-6 bg-subtle"
              >
                <DemoPortal />
              </div>
            </article>

            <article className="bento lg:col-span-2">
              <h3 className="text-[17px] font-semibold tracking-tight">Estoque que fecha sozinho</h3>
              <p className="mt-1.5 text-muted">Saiu cheio, voltou vazio. Cliente sem casco paga o vasilhame; o amassado sai como avariado.</p>
              <div className="estoque-mosaico mt-8 flex flex-wrap items-end gap-x-12 gap-y-6">
                {[
                  { nome: "Galão de água 20L", cheios: 40, vazios: 19, baixo: false },
                  { nome: "Gás P13", cheios: 42, vazios: 10, baixo: false },
                  { nome: "Gás P45", cheios: 4, vazios: 9, baixo: true },
                ].map((p, i) => (
                  <div key={p.nome} className="flex items-end gap-3">
                    <NivelVasilhame nome={p.nome} cheios={p.cheios} vazios={p.vazios} baixo={p.baixo} ordem={i} />
                    <div className="leading-tight">
                      <p className="num text-[22px] font-semibold tracking-[-0.03em]">{p.cheios}</p>
                      <p className={`text-[12px] ${p.baixo ? "text-warn-fg" : "text-muted"}`}>{p.baixo ? `${p.nome}, abaixo do mínimo` : `${p.nome}, cheios`}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {[
              { figura: SenhaDeNovo, t: "Ninguém apaga nada", d: "Erro se corrige com estorno, com a senha de quem está logado." },
              { figura: EmpresaIsolada, t: "O que é seu, só você vê", d: "Cada revenda separada das outras, até no banco de dados." },
            ].map(({ figura: Figura, t, d }) => (
              <article key={t} className="bento extra">
                <Figura className="h-20 w-full max-w-[15rem]" />
                <h3 className="mt-6 text-[17px] font-semibold tracking-tight">{t}</h3>
                <p className="mt-1.5 text-muted">{d}</p>
              </article>
            ))}

            <article className="bento extra grid items-center gap-6 sm:grid-cols-[auto_1fr] lg:col-span-3">
              <DadosSeus className="h-20 w-full max-w-[15rem]" />
              <div>
                <h3 className="text-[17px] font-semibold tracking-tight">Seus dados, quando quiser</h3>
                <p className="mt-1.5 text-muted">Relatórios por dia, entregador e produto, e tudo em planilha para baixar. Se um dia quiser sair, os dados vão com você.</p>
              </div>
            </article>
          </InView>
          </LuzCursor>
        </section>

        <section className="mx-auto grid max-w-6xl gap-16 px-4 pt-32 sm:px-6 sm:pt-44 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
          <div id="preco" className="scroll-mt-24">
            <p className="text-[13px] font-medium text-accent">Preço</p>
            <h2 className="reveal mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.035em]">
              {PRECO ? (
                <>
                  {PRECO}
                  <span className="text-[1.125rem] font-medium tracking-normal text-muted"> por mês</span>
                </>
              ) : (
                "Sob consulta"
              )}
            </h2>
            <p className="mt-3 text-muted">
              {PRECO
                ? "Com tudo o que está nesta página, para a equipe inteira."
                : "Conte quantos entregadores e quantos pedidos por dia a sua revenda tem, e a gente responde com o valor."}
            </p>
            <ul className="mt-6 space-y-2.5 border-t border-line pt-6 text-[15px]">
              {[
                "Dono, caixa, atendente e entregador",
                "Link de pedido para os clientes, com Pix",
                "Estoque de cheios, vazios e avariados",
                "Acerto de caixa por entregador",
                "Relatórios e exportação em planilha",
              ].map((x) => (
                <li key={x} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[0.6em] h-px w-3 shrink-0 bg-accent" />
                  {x}
                </li>
              ))}
            </ul>
            {temZap && <BotaoContato className="mt-8" />}
          </div>

          <div id="perguntas" className="scroll-mt-24">
            <p className="text-[13px] font-medium text-accent">Perguntas</p>
            <h2 className="reveal mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.035em]">O que todo dono pergunta.</h2>
            <div className="mt-6 border-t border-line">
              {perguntas.map(([q, a]) => (
                <details key={q} name="perguntas" className="pergunta border-b border-line">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-[16px] font-medium">
                    {q}
                    <span aria-hidden="true" className="pergunta-sinal" />
                  </summary>
                  <p className="pb-5 text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* fechamento: a mesma luz do topo, uma frase e o botão; nada mais */}
        <section className="relative isolate mt-32 overflow-hidden border-t border-line px-4 py-32 text-center sm:mt-44 sm:px-6 sm:py-40">
          <div aria-hidden="true" className="topo-luz absolute inset-0 -z-10" />
          <h2 className="reveal mx-auto max-w-[18ch] text-[2.25rem] leading-[1.06] font-semibold tracking-[-0.04em] text-balance sm:text-[3.25rem]">
            Feche o dia sabendo de tudo.
          </h2>
          <p className="mx-auto mt-5 max-w-[32rem] text-[16px] text-muted sm:text-[17px]">
            {temZap ? "Chame no WhatsApp e veja o Depósito funcionando com a rotina da sua revenda." : "Do primeiro pedido da manhã ao acerto da noite."}
          </p>
          <div className="mt-8 flex justify-center">
            <BotaoContato />
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-muted sm:px-6">
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Logo size={18} />
            <span>Um produto Solace.</span>
            <StatusSistema />
          </span>
          <nav className="flex gap-5">
            <Link href="/termos" className="alvo hover:text-fg">Termos de uso</Link>
            <Link href="/privacidade" className="alvo hover:text-fg">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
