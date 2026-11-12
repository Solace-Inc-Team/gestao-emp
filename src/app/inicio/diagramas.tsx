// Esquemas em linha para os quatro extras da página inicial, no mesmo traço do galão e do botijão.
// Cada um explica a ideia em vez de enfeitar; um único ponto âmbar marca o momento que importa.
// Os traços se desenham quando o bloco aparece (classe ink + data-inview do InView em volta).

type P = { className?: string };
const d = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;

/** O celular guarda a entrega sem sinal e manda quando a conexão volta. */
export function SemInternet({ className }: P) {
  return (
    <svg viewBox="0 0 200 84" className={`ink ${className ?? ""}`} aria-hidden="true">
      <rect pathLength={1} x="18" y="14" width="30" height="54" rx="6" />
      <path pathLength={1} d="M29 19h8" />
      <rect pathLength={1} x="25" y="34" width="16" height="10" rx="2" style={d(0.3)} />
      <path pathLength={1} d="M54 41h30" className="tracejado" style={d(0.4)} />
      <path pathLength={1} d="M90 37l8 8M98 37l-8 8" className="cota" style={d(0.5)} />
      <path pathLength={1} d="M104 41h40" className="tracejado" style={d(0.4)} />
      <rect pathLength={1} x="150" y="22" width="32" height="40" rx="4" style={d(0.2)} />
      <path pathLength={1} d="M156 32h20M156 40h20M156 48h12" style={d(0.5)} />
      <path pathLength={1} d="M33 12C70 -6 120 -6 160 18" style={d(1)} />
      <path pathLength={1} d="M152 13l8 5l-9 3" style={d(1.5)} />
      <circle cx="160" cy="18" r="2.6" className="chama" />
      <text x="14" y="80" className="nota">GUARDADO</text>
      <text x="152" y="76" className="nota">LOJA</text>
    </svg>
  );
}

/** Estorno, ajuste e inventário só passam pelo cadeado com a senha de quem está logado. */
export function SenhaDeNovo({ className }: P) {
  return (
    <svg viewBox="0 0 200 84" className={`ink ${className ?? ""}`} aria-hidden="true">
      <rect pathLength={1} x="8" y="28" width="56" height="26" rx="4" />
      <path pathLength={1} d="M64 41h22" style={d(0.4)} />
      <path pathLength={1} d="M80 36l6 5l-6 5" style={d(0.6)} />
      <rect pathLength={1} x="88" y="34" width="26" height="22" rx="3" style={d(0.5)} />
      <path pathLength={1} d="M93 34v-6a8 8 0 0 1 16 0v6" style={d(0.6)} />
      <circle cx="101" cy="43" r="2.6" className="chama" />
      <path pathLength={1} d="M101 46v4" style={d(0.8)} />
      <path pathLength={1} d="M114 41h22" style={d(0.9)} />
      <path pathLength={1} d="M130 36l6 5l-6 5" style={d(1.1)} />
      <rect pathLength={1} x="138" y="28" width="60" height="26" rx="4" style={d(1)} />
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
      <path pathLength={1} d="M97 6v70M103 6v70" className="forte" style={d(0.5)} />
      <path pathLength={1} d="M76 40h16" className="tracejado" style={d(0.9)} />
      <circle cx="94" cy="40" r="2.6" className="chama" />
      <text x="12" y="80" className="nota">EMPRESA A</text>
      <text x="126" y="80" className="nota">EMPRESA B</text>
    </svg>
  );
}

/** Tudo o que a empresa lançou sai numa planilha quando ela quiser. */
export function DadosSeus({ className }: P) {
  return (
    <svg viewBox="0 0 200 84" className={`ink ${className ?? ""}`} aria-hidden="true">
      <path pathLength={1} d="M18 22a23 7 0 0 0 46 0a23 7 0 0 0 -46 0" />
      <path pathLength={1} d="M18 22v38a23 7 0 0 0 46 0V22" style={d(0.2)} />
      <path pathLength={1} d="M18 41a23 7 0 0 0 46 0" className="cota" style={d(0.4)} />
      <path pathLength={1} d="M72 41h36" style={d(0.6)} />
      <path pathLength={1} d="M102 35l6 6l-6 6" style={d(0.8)} />
      <circle cx="110" cy="41" r="2.6" className="chama" />
      <rect pathLength={1} x="118" y="16" width="68" height="50" rx="3" style={d(0.7)} />
      <path pathLength={1} d="M118 32h68M118 49h68M141 16v50M164 16v50" className="cota" style={d(1)} />
      <text x="14" y="80" className="nota">SEUS DADOS</text>
      <text x="128" y="80" className="nota">PLANILHA</text>
    </svg>
  );
}
