// O dia da revenda numa linha só, como trecho de mapa de rota: as paradas são as horas em que algo
// acontece, e um ponto percorre o dia parando em cada uma (a parada acende quando ele chega).
// Cada parada leva à parte da página que conta aquela hora.

export const paradas = [
  { id: "h07", hora: 7, curta: "7h", nome: "Caixa" },
  { id: "h09", hora: 9, curta: "9h", nome: "Pedido" },
  { id: "h11", hora: 11, curta: "11h", nome: "Rota" },
  { id: "h13", hora: 13, curta: "13h", nome: "Sem sinal" },
  { id: "h15", hora: 15, curta: "15h", nome: "Casco" },
  { id: "h18", hora: 18, curta: "18h", nome: "Acerto" },
] as const;

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

// fração do ciclo em que o ponto chega a cada parada; o CSS usa os mesmos números
const chegada = [0, 0.15, 0.3, 0.45, 0.6, 0.8];
const CICLO = 14;

function Linha({ xs, largura, curto }: { xs: number[]; largura: number; curto: boolean }) {
  const y = 70;
  const vars = Object.fromEntries(xs.map((x, i) => [`--x${i}`, `${x}px`])) as React.CSSProperties;
  // no computador a régua mostra todas as horas de 7h às 19h; no celular só as paradas
  const marcas = curto ? [] : Array.from({ length: 13 }, (_, i) => xs[0] + (i * (xs[5] - xs[0])) / 11);
  return (
    <svg
      viewBox={`0 0 ${largura} 130`}
      className="ink relogio w-full"
      // letra em unidades do desenho: no celular o desenho é menor, então a letra pedida é menor também
      style={{ "--fs-nome": curto ? "11px" : "15px", "--fs-hora": curto ? "9.5px" : "12px" } as React.CSSProperties}
    >
      <path pathLength={1} d={`M${xs[0] - 12} ${y}H${largura - (curto ? 12 : 28)}`} />
      {marcas.map((x, i) => (
        <path key={i} d={`M${x} ${y + 6}v6`} className="cota relogio-marca" style={{ "--d": `${0.4 + i * 0.04}s` } as React.CSSProperties} />
      ))}
      {paradas.map((p, i) => (
        <a key={p.id} href={`#${p.id}`} aria-label={`${p.curta}: ${p.nome}`} className="relogio-parada" style={{ "--chega": `${chegada[i] * CICLO}s` } as React.CSSProperties}>
          {/* área de toque maior que o desenho */}
          <rect x={xs[i] - 30} y={18} width={60} height={100} className="relogio-alvo" />
          <text x={xs[i]} y={y - 22} textAnchor="middle" className="nota relogio-hora">
            {curto ? p.curta : hh(p.hora)}
          </text>
          <circle cx={xs[i]} cy={y} r={7} className="relogio-anel" />
          <text x={xs[i]} y={y + 36} textAnchor="middle" className="relogio-nome">
            {p.nome}
          </text>
        </a>
      ))}
      <circle cx={0} cy={y} r={4.5} className="relogio-ponto" style={vars} aria-hidden="true" />
    </svg>
  );
}

export function RelogioDoDia({ className = "" }: { className?: string }) {
  // computador: posição proporcional à hora (7h a 19h); celular: paradas com o mesmo espaço entre si
  const largos = paradas.map((p) => 40 + ((p.hora - 7) * 920) / 12);
  const curtos = paradas.map((_, i) => 26 + i * 61.6);
  return (
    <nav aria-label="As horas do dia na revenda" className={className}>
      <div className="hidden sm:block">
        <Linha xs={largos} largura={1000} curto={false} />
      </div>
      <div className="sm:hidden">
        <Linha xs={curtos} largura={360} curto />
      </div>
    </nav>
  );
}
