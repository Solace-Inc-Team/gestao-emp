import type { CSSProperties, ReactNode } from "react";

// Desenhos técnicos da página inicial. Todo traço tem pathLength=1 para o CSS (.ink) desenhar a linha do
// começo ao fim; o atraso de cada grupo vem em --d. Sem animação, os traços já aparecem prontos.

const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

function Cota({ x1, y1, x2, y2, children, tx, ty, rotate = 0 }: { x1: number; y1: number; x2: number; y2: number; children: ReactNode; tx: number; ty: number; rotate?: number }) {
  const vertical = x1 === x2;
  return (
    <g className="cota">
      <line pathLength={1} x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line pathLength={1} x1={x1 - 5} y1={y1} x2={x1 + 5} y2={y1} />
          <line pathLength={1} x1={x2 - 5} y1={y2} x2={x2 + 5} y2={y2} />
        </>
      ) : (
        <>
          <line pathLength={1} x1={x1} y1={y1 - 5} x2={x1} y2={y1 + 5} />
          <line pathLength={1} x1={x2} y1={y2 - 5} x2={x2} y2={y2 + 5} />
        </>
      )}
      <text x={tx} y={ty} transform={rotate ? `rotate(${rotate} ${tx} ${ty})` : undefined} textAnchor="middle" className="nota">
        {children}
      </text>
    </g>
  );
}

function Chamada({ from, to, children, anchor = "start" }: { from: [number, number]; to: [number, number]; children: ReactNode; anchor?: "start" | "end" }) {
  // linha de chamada: sai do ponto, vai até o cotovelo e corre um pouco na horizontal até o texto
  const dx = anchor === "start" ? 14 : -14;
  return (
    <g className="chamada">
      <circle cx={from[0]} cy={from[1]} r={2} className="ponto" />
      <polyline pathLength={1} points={`${from[0]},${from[1]} ${to[0]},${to[1]} ${to[0] + dx},${to[1]}`} />
      <text x={to[0] + dx * 1.3} y={to[1] + 3.5} textAnchor={anchor} className="nota">
        {children}
      </text>
    </g>
  );
}

/** Botijão P13 em vista frontal, com cotas, chamadas e a etiqueta de entrega balançando na alça. */
export function Botijao({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 420" className={`ink ${className}`} aria-hidden="true">
      <g style={d(0.3)}>
        {/* alça protetora com os dois furos */}
        <path pathLength={1} d="M108 112 V64 C108 52 116 46 128 46 H192 C204 46 212 52 212 64 V112" />
        <rect pathLength={1} x={120} y={58} width={30} height={13} rx={6.5} />
        <rect pathLength={1} x={170} y={58} width={30} height={13} rx={6.5} />
        {/* válvula */}
        <rect pathLength={1} x={150} y={84} width={20} height={24} rx={2} />
        <rect pathLength={1} x={145} y={77} width={30} height={8} rx={2} />
      </g>
      <g style={d(0.1)}>
        {/* corpo, costura e pé */}
        <path pathLength={1} d="M80 146 C80 116 120 108 160 108 C200 108 240 116 240 146 V312 C240 336 206 346 160 346 C114 346 80 336 80 312 Z" />
        <path pathLength={1} d="M80 228 C120 236 200 236 240 228" />
        <path pathLength={1} d="M100 340 V372 H220 V340" />
        <rect pathLength={1} x={116} y={354} width={20} height={9} rx={4.5} />
        <rect pathLength={1} x={184} y={354} width={20} height={9} rx={4.5} />
      </g>
      <g style={d(0.7)}>
        <rect pathLength={1} x={110} y={170} width={100} height={40} rx={3} className="tracejado" />
        <text x={160} y={187} textAnchor="middle" className="nota forte">GLP</text>
        <text x={160} y={201} textAnchor="middle" className="nota">13 kg</text>
      </g>
      <g style={d(1.1)}>
        <Cota x1={268} y1={46} x2={268} y2={372} tx={282} ty={212} rotate={90}>46 cm</Cota>
        <Cota x1={80} y1={398} x2={240} y2={398} tx={160} ty={414}>Ø 36 cm</Cota>
        <Chamada from={[160, 80]} to={[90, 24]} anchor="end">VÁLVULA</Chamada>
        <Chamada from={[82, 300]} to={[66, 300]} anchor="end">AÇO</Chamada>
      </g>
      {/* etiqueta de entrega pendurada no furo da alça */}
      <g className="etiqueta" style={d(1.5)}>
        <g className="etiqueta-corpo">
          <path pathLength={1} d="M135 64 C128 86 116 102 106 118" />
          <path pathLength={1} d="M64 118 H162 L172 128 V170 H64 Z" className="papel" />
          <circle cx={161} cy={129} r={2.6} className="ponto" />
          <text x={72} y={136} className="nota forte">#128</text>
          <text x={72} y={149} className="nota">ANA RIBEIRO</text>
          <text x={72} y={162} className="nota">JD. PRIMAVERA</text>
        </g>
      </g>
    </svg>
  );
}

/** Galão de 20 L em vista frontal; a água enche e esvazia, e o rótulo troca entre CHEIO e VAZIO. */
// o id do recorte precisa ser único na página: há um galão para computador e outro para celular
export function Galao({ id, className = "" }: { id: string; className?: string }) {
  const corpo =
    "M140 62 C98 66 76 86 76 116 V334 C76 356 90 366 112 366 H208 C230 366 244 356 244 334 V116 C244 86 222 66 180 62 Z";
  return (
    <svg viewBox="0 0 320 420" className={`ink ${className}`} aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path d={corpo} />
        </clipPath>
      </defs>
      {/* água: sobe até o gargalo, ondula e desce de novo */}
      <g clipPath={`url(#${id})`}>
        <g className="agua">
          <path className="agua-onda" d="M-80 104 Q-50 96 -20 104 T40 104 T100 104 T160 104 T220 104 T280 104 T340 104 T400 104 V420 H-80 Z" />
        </g>
      </g>
      <g style={d(0.1)}>
        <path pathLength={1} d={corpo} />
        <path pathLength={1} d="M76 176 C120 186 200 186 244 176" />
        <path pathLength={1} d="M76 262 C120 272 200 272 244 262" />
      </g>
      <g style={d(0.4)}>
        {/* gargalo, tampa e lacre */}
        <path pathLength={1} d="M140 62 V40 H180 V62" />
        <rect pathLength={1} x={132} y={20} width={56} height={20} rx={4} />
        <path pathLength={1} d="M132 30 H188" className="tracejado" />
        {/* alça no ombro */}
        <path pathLength={1} d="M192 70 C224 76 238 92 240 116" />
        <path pathLength={1} d="M192 84 C214 90 224 100 226 116" />
      </g>
      <g style={d(1.1)}>
        <Cota x1={272} y1={20} x2={272} y2={366} tx={286} ty={193} rotate={90}>52 cm</Cota>
        <Chamada from={[134, 30]} to={[100, 10]} anchor="end">LACRE</Chamada>
        <Chamada from={[78, 220]} to={[64, 220]} anchor="end">20 L</Chamada>
        <text x={160} y={398} textAnchor="middle" className="nota forte rotulo-cheio">CHEIO</text>
        <text x={160} y={398} textAnchor="middle" className="nota forte rotulo-vazio">VAZIO</text>
        <text x={160} y={412} textAnchor="middle" className="nota">RETORNÁVEL</text>
      </g>
    </svg>
  );
}

/** Marcas de registro nos cantos, como numa prancha impressa. */
export function Registro({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`ink ${className}`} aria-hidden="true">
      <g style={d(0)}>
        <circle pathLength={1} cx={12} cy={12} r={6} />
        <path pathLength={1} d="M12 0 V24 M0 12 H24" />
      </g>
    </svg>
  );
}

/** Régua vertical em centímetros, na margem da prancha. */
export function Regua({ className = "" }: { className?: string }) {
  const marcas = Array.from({ length: 41 }, (_, i) => i);
  return (
    <svg viewBox="0 0 28 410" className={`ink ${className}`} aria-hidden="true">
      <g style={d(0.2)}>
        <line pathLength={1} x1={1} y1={5} x2={1} y2={405} />
        {marcas.map((i) => (
          <line key={i} pathLength={1} x1={1} y1={5 + i * 10} x2={i % 10 === 0 ? 14 : i % 5 === 0 ? 10 : 6} y2={5 + i * 10} />
        ))}
      </g>
      {[0, 10, 20, 30, 40].map((n) => (
        <text key={n} x={17} y={8 + n * 10} className="nota">
          {n}
        </text>
      ))}
    </svg>
  );
}

/** Mapa do bairro em traço, com a rota da entrega saindo do depósito e chegando na casa. */
export function BairroRota({ className = "" }: { className?: string }) {
  const ruas = [
    "M-20 70 L1220 50",
    "M-20 170 L1220 160",
    "M-20 280 L1220 262",
    "M-20 380 L1220 372",
    "M110 -20 L130 440",
    "M330 -20 L318 440",
    "M560 -20 L575 440",
    "M790 -20 L780 440",
    "M1010 -20 L1030 440",
    "M-20 430 L1220 -10",
  ];
  const rota = "M126 382 L325 378 L560 375 L784 373 L1027 371 L1023 268 L1018 160 L1014 58";
  return (
    <svg viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" className={`ink ${className}`} aria-hidden="true">
      <g style={d(0)} className="ruas">
        {ruas.map((r) => (
          <path key={r} pathLength={1} d={r} />
        ))}
        <path pathLength={1} d="M-20 330 C200 300 300 400 520 360 S900 300 1220 340" className="corrego" />
      </g>
      <path pathLength={1} d={rota} className="rota" />
      <rect x={114} y={370} width={24} height={24} className="deposito" />
      <circle cx={1014} cy={58} r={7} className="chegada" />
    </svg>
  );
}
