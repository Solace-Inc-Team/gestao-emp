"use client";

import { useEffect, useRef, useState } from "react";
import { LiveNumber } from "@/components/live-number";

// O bairro da revenda numa faixa larga em traço fino, logo abaixo dos botões do topo. As entregas
// saem do depósito uma de cada vez: a rota se desenha pelas ruas, o entregador (o ponto) segue por
// ela e, quando chega, a casa acende, o número do pedido aparece ali mesmo e a conta do dia, logo
// acima, sobe. Tudo nasce do ponto que chegou. Fora da tela ou com a aba escondida, para; sem
// movimento pedido, o bairro fica parado.

const RUAS_V = [100, 280, 450, 600, 720, 840, 990, 1160, 1340];
const RUAS_H = [40, 150, 260];
const DEPOSITO = [720, 150] as const;

type Entrega = { n: number; casa: [number, number]; rota: string; cents: number };

// rotas sempre pelas ruas; as mais perto do depósito também aparecem no celular, onde a faixa corta as bordas
const ENTREGAS: Omit<Entrega, "n">[] = [
  { casa: [450, 40], rota: "M720 150H450V40", cents: 11500 },
  { casa: [990, 260], rota: "M720 150V260H990", cents: 1400 },
  { casa: [1160, 40], rota: "M720 150V40H1160", cents: 11500 },
  { casa: [600, 260], rota: "M720 150V260H600", cents: 2800 },
  { casa: [280, 260], rota: "M720 150V260H280", cents: 11500 },
  { casa: [840, 40], rota: "M720 150V40H840", cents: 1400 },
  { casa: [1340, 150], rota: "M720 150H1340", cents: 11500 },
  { casa: [100, 40], rota: "M720 150H280V40H100", cents: 4200 },
];

const VIAGEM = 1500; // ms do depósito até a casa
const INTERVALO = 2000; // ms entre uma saída e a próxima: sempre tem alguém na rua
const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function MapaVivo({ className = "" }: { className?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const rota = useRef<SVGPathElement>(null);
  const ponto = useRef<SVGCircleElement>(null);
  // a entrega da vez e a anterior, que se apaga devagar enquanto a nova sai
  const [par, setPar] = useState<{ atual: Entrega | null; anterior: Entrega | null }>({ atual: null, anterior: null });
  const [chegou, setChegou] = useState(false);
  const [dia, setDia] = useState({ entregas: 46, cents: 512_300 });
  const [ativo, setAtivo] = useState(false);
  const atual = par.atual;

  // só roda com o bairro na tela, a aba à vista e sem pedido de menos movimento
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

  // uma saída a cada intervalo
  useEffect(() => {
    if (!ativo) return;
    let n = atual ? atual.n + 1 : 0;
    const sai = () => {
      setChegou(false);
      const nova = { n, ...ENTREGAS[n % ENTREGAS.length] };
      setPar((p) => ({ atual: nova, anterior: p.atual }));
      n++;
    };
    const primeira = setTimeout(sai, atual ? 400 : 700);
    const id = setInterval(sai, INTERVALO);
    return () => {
      clearTimeout(primeira);
      clearInterval(id);
    };
    // atual fica de fora de propósito: o relógio das saídas não recomeça a cada entrega
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  // o ponto segue a rota; ao chegar, a casa acende e a conta do dia sobe
  useEffect(() => {
    const caminho = rota.current;
    const bolinha = ponto.current;
    if (!atual || !caminho || !bolinha) return;
    const total = caminho.getTotalLength();
    const inicio = performance.now();
    let quadro = 0;
    const anda = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / VIAGEM);
      const p = caminho.getPointAtLength(suave(t) * total);
      bolinha.setAttribute("cx", String(p.x));
      bolinha.setAttribute("cy", String(p.y));
      if (t < 1) quadro = requestAnimationFrame(anda);
      else {
        setChegou(true);
        setDia((d) => ({ entregas: d.entregas + 1, cents: d.cents + atual.cents }));
      }
    };
    quadro = requestAnimationFrame(anda);
    return () => cancelAnimationFrame(quadro);
  }, [atual]);

  return (
    <div ref={caixa} className={`flex flex-col ${className}`}>
      {/* a conta do dia, que sobe a cada chegada: é a mesma conta que o acerto da noite fecha */}
      <p className="num px-4 text-center font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
        Hoje · <LiveNumber value={dia.entregas} className="text-fg" /> entregas · <LiveNumber value={dia.cents} cents className="text-fg" /> recebidos
      </p>
      <svg viewBox="0 0 1440 300" preserveAspectRatio="xMidYMid slice" className="mapa-vivo ink mt-6 block h-[220px] w-full flex-none sm:h-auto sm:min-h-[220px] sm:flex-1" aria-hidden="true">
        <g className="mapa-ruas">
          {RUAS_H.map((y) => (
            <path key={`h${y}`} d={`M-20 ${y}H1460`} />
          ))}
          {RUAS_V.map((x) => (
            <path key={`v${x}`} d={`M${x} -20V320`} />
          ))}
          <path d="M-20 300L330 -20" />
          <path d="M1040 320C1100 210 1260 200 1460 90" className="mapa-corrego" />
        </g>
        {/* nomes de rua em letra técnica, como numa planta */}
        <text x={300} y={142} className="nota mapa-rua">RUA XV DE NOVEMBRO</text>
        <text x={860} y={252} className="nota mapa-rua">AV. BRASIL</text>
        <text x={1004} y={32} className="nota mapa-rua">RUA DAS FLORES</text>
        {ENTREGAS.map((e) => (
          <rect key={`${e.casa}`} x={e.casa[0] - 5} y={e.casa[1] - 5} width={10} height={10} rx={2} className="mapa-casa" />
        ))}
        <rect x={DEPOSITO[0] - 10} y={DEPOSITO[1] - 10} width={20} height={20} rx={3} className="mapa-deposito" />
        <text x={DEPOSITO[0] + 18} y={DEPOSITO[1] + 26} className="nota mapa-legenda">
          DEPÓSITO
        </text>
        {[par.anterior, par.atual].map((e) => {
          if (!e) return null;
          const daVez = e === par.atual;
          // casa perto da borda direita: o número vai para o lado de dentro
          const dentro = e.casa[0] > 1200;
          return (
            <g key={e.n} className="mapa-entrega" data-chegou={daVez ? chegou : true} data-saindo={!daVez}>
              <path ref={daVez ? rota : undefined} d={e.rota} pathLength={1} className="mapa-rota" />
              <circle cx={e.casa[0]} cy={e.casa[1]} r={9} className="mapa-chegada" />
              <rect x={e.casa[0] - 5} y={e.casa[1] - 5} width={10} height={10} rx={2} className="mapa-casa-acesa" />
              <text x={e.casa[0] + (dentro ? -14 : 14)} y={e.casa[1] - 12} textAnchor={dentro ? "end" : "start"} className="nota mapa-rotulo">
                #{128 + e.n} · ENTREGUE
              </text>
              <circle ref={daVez ? ponto : undefined} cx={daVez ? DEPOSITO[0] : e.casa[0]} cy={daVez ? DEPOSITO[1] : e.casa[1]} r={5} className="mapa-ponto" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
