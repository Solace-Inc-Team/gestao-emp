import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { dashboard, listDrivers, primeirosPassos } from "@/domain/queries";
import { todayISO } from "@/lib/period";
import { LiveNumber } from "@/components/live-number";
import { SemanaBarras } from "@/components/semana-barras";
import { comparar } from "@/lib/comparativo";
import { DivisaoPagamento } from "@/components/divisao-pagamento";
import { FiltroPainel } from "./filtro-painel";
import { PrimeirosPassos } from "./primeiros-passos";
import { Money, StatusBadge, Empty, fmtTime, paymentLabel } from "@/components/ui";

export const metadata = { title: "Painel" };

export default async function Painel({ searchParams }: PageProps<"/">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const sp = await searchParams;
  const hojeISO = todayISO();
  // dia futuro ou malformado volta para hoje; entregador só vale se for da empresa
  const dia = typeof sp.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) && sp.dia <= hojeISO ? sp.dia : hojeISO;
  const entregadores = await listDrivers(user.tenantId);
  const entregador = entregadores.find((e) => e.id === sp.entregador);
  const d = await dashboard(user.tenantId, { day: dia, driverId: entregador?.id });
  // os primeiros passos são tarefas do dono; os outros perfis não têm acesso a metade das telas
  const passos = user.role === "dono" ? await primeirosPassos(user.tenantId) : null;
  const ehHoje = dia === hojeISO;
  const filtrado = !ehHoje || !!entregador;
  const hoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(
    new Date(`${dia}T12:00:00-03:00`),
  );
  const noDia = ehHoje ? "hoje" : `em ${dia.split("-").reverse().slice(0, 2).join("/")}`;
  const comparativo = comparar(d.revenue, d.previous, d.emAndamento ? "andamento" : "fechado");

  // grave: dinheiro ou cliente esperando agora; aviso: precisa de conferência; dica: configuração
  const alertas: Alerta[] = [];
  if (d.late > 0) alertas.push({ tom: "grave", texto: `${d.late} ${d.late === 1 ? "pedido atrasado" : "pedidos atrasados"}`, href: "/entregas", acao: "Ver entregas" });
  if (d.pendingDifferences > 0)
    alertas.push({
      tom: "grave",
      texto: `${d.pendingDifferences} ${d.pendingDifferences === 1 ? "acerto com diferença esperando" : "acertos com diferença esperando"} resolução`,
      href: "/caixa",
      acao: "Ver acertos",
    });
  if (d.returned > 0)
    alertas.push({ tom: "aviso", texto: `${d.returned} ${d.returned === 1 ? "pedido voltou" : "pedidos voltaram"} da rua sem entrega`, href: "/entregas", acao: "Resolver" });
  if (d.pixToCheck > 0)
    alertas.push({
      tom: "aviso",
      texto: `${d.pixToCheck} ${d.pixToCheck === 1 ? "Pix entregue ainda não conferido" : "Pix entregues ainda não conferidos"} no extrato`,
      href: "/pedidos?status=entregue",
      acao: "Conferir",
    });
  for (const p of d.lowStock)
    alertas.push({ tom: "aviso", texto: `${p.name}: ${p.fullStore} cheios na loja (mínimo ${p.minStock})`, href: "/estoque", acao: "Ver estoque" });
  if (user.role === "dono" && !user.totpEnabled)
    alertas.push({ tom: "dica", texto: "Proteja o acesso ao caixa: ative a verificação em duas etapas", href: "/senha", acao: "Ativar" });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted first-letter:uppercase">{hoje}</p>
          <h1 className="h1">Painel do dia{entregador ? `: ${entregador.name}` : ""}</h1>
        </div>
        {/* filtro: as vendas mudam com o dia e o entregador; fila e dinheiro na rua são sempre de agora */}
        <FiltroPainel ativo={filtrado} acao={<Link href="/pedidos/novo" className="btn btn-primary">Novo pedido</Link>}>
          <div>
            <label className="label" htmlFor="dia">Dia</label>
            <input id="dia" name="dia" type="date" max={hojeISO} defaultValue={dia} className="input" />
          </div>
          <div className="min-w-0 flex-1 sm:flex-none">
            <label className="label" htmlFor="entregador">Entregador</label>
            <select id="entregador" name="entregador" defaultValue={entregador?.id ?? ""} className="input">
              <option value="">Todos</option>
              {entregadores.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <button className="btn">Ver</button>
          {filtrado && <Link href="/" className="btn">Hoje, todos</Link>}
        </FiltroPainel>
      </div>

      {passos && <PrimeirosPassos feito={passos} />}

      <section className="panel mb-6 grid divide-line sm:grid-cols-3 sm:divide-x">
        <div className="p-5">
          <p className="text-muted">Vendido {noDia}</p>
          <LiveNumber value={d.revenue} cents fromZero="once" className="text-[2rem] leading-tight font-semibold tracking-[-0.03em]" />
          <p className="mt-1 text-sm text-muted">
            {d.deliveredCount} {d.deliveredCount === 1 ? "pedido entregue" : "pedidos entregues"}
            {comparativo && (
              <>
                {" · "}
                <span className={comparativo.tom === "sobe" ? "text-ok" : comparativo.tom === "desce" ? "text-danger" : ""}>{comparativo.texto}</span>
              </>
            )}
          </p>
          <SemanaBarras semana={d.week} />
        </div>
        <div className="border-t border-line p-5 sm:border-t-0">
          <p className="text-muted">Dinheiro na rua agora</p>
          <LiveNumber value={d.cashInStreet} cents fromZero="once" className="text-[2rem] leading-tight font-semibold tracking-[-0.03em]" />
          <p className="mt-1 text-sm text-muted">
            com {d.openShifts.length} {d.openShifts.length === 1 ? "entregador" : "entregadores"}, a acertar
          </p>
        </div>
        <div className="border-t border-line p-5 sm:border-t-0">
          <p className="text-muted">Fila agora</p>
          <p className="num text-[2rem] leading-tight font-semibold tracking-[-0.03em]">
            <LiveNumber value={d.pending} fromZero="once" /> <span className="text-xl font-medium text-muted">aguardando</span>
          </p>
          <p className="mt-1 text-sm text-muted">{d.inRoute} em rota</p>
        </div>
      </section>

      {alertas.length > 0 && (
        // um bloco só, do mais grave para o menos: a gravidade fica no ponto (o urgente com um halo),
        // o texto na cor normal; frase inteira em vermelho gritava, principalmente no escuro
        <section aria-labelledby="atencao" className="panel mb-6">
          <h2 id="atencao" className="h2 border-b border-line px-4 py-3">Precisa de atenção</h2>
          <ul>
            {alertas.map((a) => (
              <li key={a.texto} className="border-b border-line last:border-0">
                <Link href={a.href} className="group flex items-center gap-3 px-4 py-3 hover:bg-subtle">
                  <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tomPonto[a.tom]}`} />
                  <span className={`flex-1 ${a.tom === "grave" ? "font-medium" : ""}`}>
                    {a.texto}
                    <span className="sr-only">{tomLeitura[a.tom]}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm text-muted transition-colors group-hover:text-fg">
                    {a.acao}
                    <ChevronRight size={14} strokeWidth={2} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="h2">Pedidos {ehHoje ? "de hoje" : noDia}</h2>
            <Link href="/pedidos" className="alvo text-sm text-accent hover:underline">Ver todos</Link>
          </div>
          {d.recent.length ? (
            <table className="table">
              <tbody>
                {d.recent.map((o) => (
                  <tr key={o.id}>
                    <td className="num w-12 text-muted">#{o.number}</td>
                    <td>
                      <Link href={`/pedidos/${o.id}`} className="font-medium hover:text-accent">
                        {o.customerName ?? "Balcão"}
                      </Link>
                      <p className="text-sm text-muted">
                        {fmtTime(o.createdAt)}
                        {o.driverName ? `, ${o.driverName}` : ""}
                      </p>
                    </td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right"><Money cents={o.totalCents} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            filtrado ? (
              <Empty>Nenhum pedido {noDia}{entregador ? ` com ${entregador.name}` : ""}.</Empty>
            ) : (
              <Empty>Nenhum pedido hoje. <Link href="/pedidos/novo" className="text-accent underline">Lançar o primeiro</Link></Empty>
            )
          )}
        </section>

        <div className="space-y-6">
          <section className="panel">
            <h2 className="h2 border-b border-line px-4 py-3">Entregadores em turno agora</h2>
            {d.openShifts.length ? (
              <ul>
                {d.openShifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                    <div>
                      <p className="font-medium">{s.driverName}</p>
                      <p className="text-sm text-muted">
                        {s.orderCount} {s.orderCount === 1 ? "pedido" : "pedidos"}, {s.inRoute} em rota
                      </p>
                    </div>
                    <Link href={`/caixa/${s.id}`} className="text-right">
                      <Money cents={s.expected} className="block font-semibold" />
                      <span className="text-sm text-accent">Fazer acerto</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhum turno aberto. <Link href="/caixa" className="text-accent underline">Abrir turno</Link></Empty>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="h2 mb-3">Recebido {noDia}, por forma de pagamento</h2>
            {/* a mesma barra do acerto e dos relatórios; sem nada recebido, uma linha só em vez de quatro zeros */}
            {Object.values(d.byMethod).some((v) => v > 0) ? (
              <DivisaoPagamento
                partes={(Object.keys(paymentLabel) as (keyof typeof paymentLabel)[]).map((k) => ({ rotulo: paymentLabel[k], cents: d.byMethod[k] }))}
              />
            ) : (
              <p className="text-muted">Nada recebido {noDia}{ehHoje ? " ainda" : ""}.</p>
            )}
            {d.sold.length > 0 && (
              <>
                <h3 className="mt-5 mb-2 font-semibold">Saiu {noDia}</h3>
                <ul className="space-y-1">
                  {d.sold.map((s) => (
                    <li key={s.name} className="flex justify-between">
                      <span>{s.name}</span>
                      <span className="num font-semibold">{s.qty}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

type Alerta = { tom: "grave" | "aviso" | "dica"; texto: string; href: string; acao: string };
const tomPonto = { grave: "bg-danger ring-4 ring-danger/20", aviso: "bg-warn", dica: "bg-accent" };
// a cor do ponto não chega a quem usa leitor de tela
const tomLeitura = { grave: " (urgente)", aviso: " (conferir)", dica: "" };
