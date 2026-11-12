// Esquemas em linha para as garantias da página inicial, no mesmo traço do galão e do botijão.
// Cada um explica a ideia em vez de enfeitar, numa cor só. Os traços se desenham quando o bloco
// aparece (classe ink + data-inview do InView em volta); depois, ao passar o cursor (ou sozinho, no
// celular), a história acontece: um traço curto corre pela ligação (classe fluxo) e cada esquema
// tem o seu detalhe, como o cadeado que abre e a planilha que se preenche.

type P = { className?: string };
const d = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;

/** Estorno, ajuste e inventário só passam pelo cadeado com a senha de quem está logado. */
export function SenhaDeNovo({ className }: P) {
  return (
    <svg viewBox="0 0 200 84" className={`ink ${className ?? ""}`} aria-hidden="true">
      <rect pathLength={1} x="8" y="28" width="56" height="26" rx="4" />
      <path pathLength={1} d="M64 41h22" style={d(0.4)} />
      <path pathLength={1} d="M80 36l6 5l-6 5" style={d(0.6)} />
      <rect pathLength={1} x="88" y="34" width="26" height="22" rx="3" style={d(0.5)} />
      <path pathLength={1} d="M93 34v-6a8 8 0 0 1 16 0v6" className="argola" style={d(0.6)} />
      <circle cx="101" cy="43" r="2.2" className="ponto marco" />
      <path pathLength={1} d="M101 46v4" style={d(0.8)} />
      <path pathLength={1} d="M114 41h22" style={d(0.9)} />
      <path pathLength={1} d="M130 36l6 5l-6 5" style={d(1.1)} />
      <rect pathLength={1} x="138" y="28" width="60" height="26" rx="4" style={d(1)} />
      <path pathLength={1} d="M64 41H136" className="fluxo" />
      <text x="15" y="44.5" className="nota">ESTORNO</text>
      <text x="145" y="44.5" className="nota">REGISTRO</text>
      <text x="88" y="72" className="nota">SENHA</text>
    </svg>
  );
}

/** Cada empresa num lado da parede: o que é de uma não atravessa para a outra. */
export function EmpresaIsolada({ className }: P) {
  return (
    <svg viewBox="0 0 200 84" className={`ink ${className ?? ""}`} aria-hidden="true">
      <rect pathLength={1} x="10" y="14" width="66" height="52" rx="6" />
      <rect pathLength={1} x="124" y="14" width="66" height="52" rx="6" style={d(0.2)} />
      <circle cx="28" cy="34" r="2.4" className="ponto" />
      <circle cx="44" cy="48" r="2.4" className="ponto" />
      <circle cx="58" cy="30" r="2.4" className="ponto" />
      <circle cx="142" cy="44" r="2.4" className="ponto" />
      <circle cx="160" cy="30" r="2.4" className="ponto" />
      <circle cx="172" cy="50" r="2.4" className="ponto" />
      <path pathLength={1} d="M97 6v70M103 6v70" className="forte parede" style={d(0.5)} />
      <path pathLength={1} d="M76 40h16" className="tracejado" style={d(0.9)} />
      {/* a tentativa corre até a parede e para ali */}
      <path pathLength={1} d="M58 30C70 40 80 40 95 40" className="fluxo fluxo-barrado" />
      <circle cx="94" cy="40" r="2.2" className="ponto marco" />
      <text x="12" y="80" className="nota">EMPRESA A</text>
      <text x="126" y="80" className="nota">EMPRESA B</text>
    </svg>
  );
}

/** Tudo o que a empresa lançou sai numa planilha quando ela quiser. */
export function DadosSeus({ className }: P) {
  // células da planilha que se preenchem uma a uma (linha por linha, da esquerda para a direita)
  const celulas = [
    [122, 36], [145, 36], [168, 36],
    [122, 53], [145, 53], [168, 53],
  ];
  return (
    <svg viewBox="0 0 200 84" className={`ink ${className ?? ""}`} aria-hidden="true">
      <path pathLength={1} d="M18 22a23 7 0 0 0 46 0a23 7 0 0 0 -46 0" />
      <path pathLength={1} d="M18 22v38a23 7 0 0 0 46 0V22" style={d(0.2)} />
      <path pathLength={1} d="M18 41a23 7 0 0 0 46 0" className="cota" style={d(0.4)} />
      <path pathLength={1} d="M72 41h36" style={d(0.6)} />
      <path pathLength={1} d="M102 35l6 6l-6 6" style={d(0.8)} />
      <rect pathLength={1} x="118" y="16" width="68" height="50" rx="3" style={d(0.7)} />
      <path pathLength={1} d="M118 32h68M118 49h68M141 16v50M164 16v50" className="cota" style={d(1)} />
      {celulas.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="15" height="9" rx="1.5" className="celula" style={{ "--c": i } as React.CSSProperties} />
      ))}
      <path pathLength={1} d="M64 41h44" className="fluxo" />
      <text x="14" y="80" className="nota">SEUS DADOS</text>
      <text x="128" y="80" className="nota">PLANILHA</text>
    </svg>
  );
}
