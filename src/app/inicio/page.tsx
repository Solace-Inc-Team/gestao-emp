import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { TemaBotao } from "@/components/tema-botao";
import { StatusSistema } from "@/components/status-sistema";
import { ArrowRight, BadgeCheck, MessageCircle, MonitorSmartphone, Users, WifiOff } from "lucide-react";
import { Logo } from "@/components/logo";
import { InView } from "@/components/in-view";
import { LiveNumber } from "@/components/live-number";
import { BairroRota } from "./prancha";
import { DemoAcerto } from "./demo-acerto";
import { DemoCelular } from "./demo-celular";
import { DemoEntrega } from "./demo-entrega";
import { DemoPortal } from "./demo-portal";
import { Prateleira } from "./prateleira";
import { DadosSeus, EmpresaIsolada, SenhaDeNovo } from "./diagramas";
import { RelogioDoDia, paradas } from "./relogio-do-dia";
import { PainelVivo } from "./painel-vivo";
import { PRECO, WHATSAPP, linkWhatsApp } from "./contato";

export const metadata = {
  title: { absolute: "Depósito: gestão para revendas de água e gás" },
  description:
    "Pedido, entrega, cascos e acerto de caixa num lugar só, para revendas de água e gás.",
};

// as duas perguntas que o dono faz todo dia, uma por linha
const titulo = ["Onde está cada casco.", "Quanto cada entregador te deve."].map((l) => l.split(" "));
const atraso = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
const temZap = WHATSAPP !== "";
const fatos = [
  { icone: WifiOff, t: "Funciona sem internet", d: "A entrega confirmada no celular sobe sozinha quando o sinal volta." },
  { icone: MonitorSmartphone, t: "Nada para instalar", d: "Abre no navegador do computador e do celular." },
  { icone: Users, t: "4 perfis de acesso", d: "Dono, caixa, atendente e entregador, cada um no seu." },
  { icone: BadgeCheck, t: "Acerto no centavo", d: "O sistema já sabe quanto cada entregador tem que apresentar." },
];
const zap = linkWhatsApp("Olá! Quero conhecer o Depósito para a minha revenda.");

// o dia da revenda, hora a hora: o texto fala da rotina do dono, e o desenho ao lado mostra a tela
const dia: Record<(typeof paradas)[number]["id"], { t: string; d: string; largo?: boolean; figura: ReactNode }> = {
  h07: {
    t: "O entregador sai com o troco contado.",
    d: "Abrir o turno leva um toque. Fica anotado quanto de troco cada um levou, quem entregou o dinheiro e a que horas, para a conta da noite começar certa.",
    figura: <TurnosAbertos />,
  },
  h09: {
    t: "O pedido chega por onde o cliente quiser.",
    d: "Telefone, balcão, WhatsApp ou o link da loja, onde o cliente pede sozinho e já recebe o QR do Pix. O preço vem do cadastro, sem ninguém fazer conta.",
    figura: (
      <div role="img" aria-label="No celular, o cliente põe um Gás P13, escolhe Pix e faz o pedido; aparece Pedido #62 recebido com o QR do Pix" className="dia-tela">
        <DemoPortal />
      </div>
    ),
  },
  h11: {
    t: "Cada entrega com dono, do balcão até a porta.",
    d: "O atendente escolhe o entregador e o botijão sai reservado do estoque. A loja vê no painel o que está na rua; o entregador vê no celular só as entregas dele.",
    largo: true,
    figura: (
      <div role="img" aria-label="O entregador toca em Entreguei e recebi no celular, e no painel da loja o pedido vira Entregue e o vendido do dia sobe">
        <DemoEntrega />
      </div>
    ),
  },
  h13: {
    t: "Rua sem sinal não segura a entrega.",
    d: "O entregador confirma assim mesmo: a entrega fica guardada no celular e sobe sozinha quando a conexão volta. Tocou errado? Tem 5 segundos para desfazer.",
    figura: (
      <div
        role="img"
        aria-label="No celular, o João toca em Entreguei e recebi, desfaz dentro dos 5 segundos, toca de novo e o dinheiro que ele deve ter sobe de R$ 248,00 para R$ 363,00"
        className="dia-tela"
      >
        <DemoCelular />
      </div>
    ),
  },
  h15: {
    t: "Saiu cheio, voltou vazio. O estoque fecha sozinho.",
    d: "Cada entrega baixa um cheio e devolve um vazio. Cliente sem casco paga o vasilhame, e o que volta amassado sai separado, como avariado.",
    figura: <Cascos />,
  },
  h18: {
    t: "Na hora do acerto, a conta já está pronta.",
    d: "O sistema sabe quanto cada entregador tem que apresentar: troco, vendas em dinheiro, repasses e gastos. O caixa conta e fecha no centavo, ou a diferença fica registrada até o dono decidir.",
    figura: (
      <div
        role="img"
        aria-label="Acerto do João: deve apresentar R$ 165,00, o caixa digita 165,00, o sistema mostra bateu, sem diferença, e o acerto é fechado"
        className="dia-tela overflow-hidden rounded-2xl border border-line bg-subtle"
      >
        <DemoAcerto />
      </div>
    ),
  },
};

const garantias = [
  { figura: SenhaDeNovo, t: "Ninguém apaga nada", d: "Erro se corrige com estorno, com a senha de quem está logado, e fica no histórico com nome e hora." },
  { figura: EmpresaIsolada, t: "O que é seu, só você vê", d: "Cada revenda tem os dados separados das outras, em toda tela e no próprio banco de dados." },
  { figura: DadosSeus, t: "Seus dados, quando quiser", d: "Relatórios por dia, entregador e produto, e tudo em planilha para baixar quando precisar." },
];

const perguntas = [
  ["Precisa instalar alguma coisa?", "Não. O Depósito abre no navegador do computador e do celular. No celular do entregador dá para pôr um ícone na tela inicial, como um aplicativo."],
  ["Emite nota fiscal?", "Ainda não. O Depósito cuida da operação: pedido, entrega, estoque e caixa. A nota continua no emissor que você já usa."],
  ["E se o celular do entregador ficar sem internet?", "Ele confirma a entrega mesmo assim. A confirmação fica guardada no aparelho e é enviada sozinha quando o sinal volta, sem duplicar."],
  ["O cliente consegue pedir sozinho?", "Sim. Cada loja tem um link de pedido. O pedido cai na fila com o selo do site e, se for Pix, o cliente já recebe o QR para pagar."],
  ["Quem trabalha comigo vê tudo?", "Não. São quatro perfis, dono, caixa, atendente e entregador, e cada um vê só o que é seu."],
  ["Se eu quiser sair, levo meus dados?", "Sim. O dono baixa todos os dados da empresa em planilhas, num arquivo só, quando quiser."],
];

/** Os turnos que abriram de manhã, como aparecem no caixa: linha por linha, na ordem em que saíram. */
function TurnosAbertos() {
  const turnos = [
    ["João Pereira", "R$ 50,00", "07:02"],
    ["Rafael Lima", "R$ 40,00", "07:05"],
    ["Ana Souza", "R$ 50,00", "07:11"],
  ];
  return (
    <div className="dia-tela overflow-hidden rounded-2xl border border-line bg-surface text-[14px]">
      <p className="flex items-center justify-between border-b border-line px-5 py-3 text-[13px] text-muted">
        <span>Caixa · turnos de hoje</span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-ok" />3 na rua
        </span>
      </p>
      <table className="num w-full">
        <tbody>
          {turnos.map(([nome, troco, hora], i) => (
            <tr key={nome} style={atraso(200 + i * 160)} className="print border-t border-line first:border-t-0">
              <td className="py-3 pr-2 pl-4 font-medium sm:px-5">{nome}</td>
              <td className="px-2 py-3 whitespace-nowrap text-muted sm:px-5">troco {troco}</td>
              <td className="py-3 pr-4 pl-2 text-right whitespace-nowrap text-muted sm:px-5">{hora}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-5 py-3 text-[13px] text-muted">Abertos por Marina, no caixa.</p>
    </div>
  );
}

/** A faixa âmbar do estoque: os números de cascos e a prateleira que esvazia e enche. */
function Cascos() {
  return (
    <div className="faixa-chama dia-tela overflow-hidden rounded-2xl p-6 sm:p-8">
      <p className="font-mono text-[11px] tracking-[0.14em] uppercase">Gás P13 · loja</p>
      <dl className="mt-4 grid grid-cols-3 border-t border-current/25 font-mono text-[11px] tracking-[0.12em] uppercase">
        {[
          ["Cheios", 42],
          ["Vazios", 18],
          ["Avariados", 2],
        ].map(([t, n]) => (
          <div key={t} className="pt-4">
            <dt className="opacity-70">{t}</dt>
            <dd className="mt-1 font-sans text-[2rem] font-semibold tracking-tight">
              <LiveNumber value={n as number} fromZero="visible" />
            </dd>
          </div>
        ))}
      </dl>
      <Prateleira quantos={12} className="mt-8" />
    </div>
  );
}

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

export default function Inicio() {
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
        {/* topo: o produto é o protagonista. Atrás do título só luz; o Painel chega deitado e endireita ao rolar */}
        <section className="topo-novo relative isolate pt-20 sm:pt-28">
          <div aria-hidden="true" className="topo-luz absolute inset-0 -z-10" />
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <p style={atraso(0)} className="hero-in inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-muted">
              <span className="size-1.5 rounded-full bg-ok" />
              Para revendas de água e gás
            </p>
            <h1 className="mx-auto mt-6 max-w-[16ch] text-[2.5rem] leading-[1.04] font-semibold tracking-[-0.045em] text-balance sm:max-w-none sm:text-[3.25rem] lg:text-[4.25rem]">
              {/* cada palavra entra sozinha, na ordem de leitura; o espaço fica fora para não ser comido pelo inline-block */}
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
              <a href="#dia" className="btn h-11 px-5 text-[15px]">Ver como funciona</a>
            </div>
            {temZap && (
              <p style={atraso(440)} className="hero-in mt-4 text-[13px] text-muted">
                Já é cliente? <Link href="/login" className="text-fg underline-offset-4 hover:underline">Entrar</Link>
              </p>
            )}
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

        <section id="dia" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
          <p className="text-[13px] font-medium text-accent">Um dia na revenda</p>
          <h2 className="reveal mt-2 max-w-[22ch] text-[2rem] leading-tight font-semibold tracking-[-0.035em] sm:text-[2.5rem]">
            Das 7h às 18h, cada coisa anotada no lugar certo.
          </h2>
          {/* o índice do dia: cada parada leva à sua hora logo abaixo */}
          <InView className="mt-12 max-w-5xl">
            <RelogioDoDia />
          </InView>

          <ol className="mt-16 sm:mt-20">
            {paradas.map((p, i) => {
              const { t, d, largo, figura } = dia[p.id];
              const ultima = i === paradas.length - 1;
              return (
                <li key={p.id} id={p.id} className="scroll-mt-24">
                  {/* a linha à esquerda é o trajeto do dia: cada trecho se desenha quando a parada aparece */}
                  <InView className={`dia-parada ${ultima ? "dia-ultima" : ""}`}>
                    <div className={`grid gap-8 lg:gap-12 ${largo ? "" : "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-center"}`}>
                      <div className="dia-texto max-w-xl">
                        <p className="num font-mono text-[13px] tracking-[0.08em] text-accent">
                          {String(p.hora).padStart(2, "0")}:00 · {p.nome.toUpperCase()}
                        </p>
                        <h3 className="mt-3 text-[1.5rem] leading-tight font-semibold tracking-[-0.03em] sm:text-[1.75rem]">{t}</h3>
                        <p className="mt-3 text-[16px] leading-relaxed text-muted">{d}</p>
                      </div>
                      {/* a tela larga (11h) passa da borda de propósito: no celular ela sangra até o canto da tela, para o corte parecer intencional */}
                      <div className={`dia-figura min-w-0 ${largo ? "-mr-4 sm:mr-0" : ""}`}>{figura}</div>
                    </div>
                  </InView>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="border-y border-line bg-surface/60">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
            <p className="text-[13px] font-medium text-accent">Depois das 18h</p>
            <h2 className="reveal mt-2 max-w-[22ch] text-[2rem] leading-tight font-semibold tracking-[-0.035em] sm:text-[2.5rem]">
              O que segura a conta no dia seguinte.
            </h2>
            {/* cada garantia com um esquema em linha que explica a ideia; os traços se desenham ao aparecer */}
            <InView className="mt-14">
              <ul className="grid gap-x-10 gap-y-12 sm:grid-cols-3">
                {garantias.map(({ figura: Figura, t, d }) => (
                  <li key={t} className="extra border-t border-line pt-5">
                    <Figura className="h-20 w-full max-w-[15rem]" />
                    <h3 className="mt-5 font-semibold">{t}</h3>
                    <p className="mt-1 text-muted">{d}</p>
                  </li>
                ))}
              </ul>
            </InView>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-16 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
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
            {/* sem WhatsApp não há a quem pedir o valor; "Entrar" aqui confundiria quem ainda não é cliente */}
            {temZap && <BotaoContato className="mt-8" />}
          </div>

          <div id="perguntas" className="scroll-mt-24">
            <p className="text-[13px] font-medium text-accent">Perguntas</p>
            <h2 className="reveal mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.035em]">O que todo dono pergunta.</h2>
            <div className="mt-6 border-t border-line">
              {perguntas.map(([q, a]) => (
                // mesmo name: abrir uma pergunta fecha a outra
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

        <section className="px-4 pb-24 sm:px-6 sm:pb-32">
          <InView className="cta-band relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-20 text-center sm:py-24">
            <BairroRota className="pointer-events-none absolute inset-0 -z-10 h-full w-full" />
            <p className="font-mono text-[12px] tracking-[0.14em] text-white/80 uppercase">18:00 · Acerto</p>
            <h2 className="reveal mx-auto mt-3 max-w-[20ch] text-[2rem] leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-[2.75rem]">
              Feche o dia sabendo de tudo.
            </h2>
            <p className="mx-auto mt-4 max-w-[32rem] text-white/80">
              {temZap ? "Chame no WhatsApp e veja o Depósito funcionando com a rotina da sua revenda." : "Dono, caixa, atendente e entregador, cada um vendo só o que é seu."}
            </p>
            {temZap ? (
              <a href={zap} target="_blank" rel="noopener noreferrer" className="btn mt-8 h-11 border-white bg-white px-5 text-[15px] text-[var(--marca-forte)] hover:bg-white/90">
                <MessageCircle className="size-4" aria-hidden="true" /> Conversar no WhatsApp
              </a>
            ) : (
              <Link href="/login" className="btn mt-8 h-11 border-white bg-white px-5 text-[15px] text-[var(--marca-forte)] hover:bg-white/90">
                Entrar no sistema <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </InView>
        </section>
      </main>

      <footer className="border-t border-line">
        {/* o mesmo motivo do estoque fechando a página, quieto e cortado nas bordas */}
        <InView className="overflow-hidden pt-8">
          <Prateleira quantos={48} className="justify-center text-line" />
        </InView>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-muted sm:px-6">
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>Depósito, um produto Solace.</span>
            <StatusSistema />
          </span>
          <nav className="flex gap-5">
            <Link href="/termos" className="hover:text-fg">Termos de uso</Link>
            <Link href="/privacidade" className="hover:text-fg">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
