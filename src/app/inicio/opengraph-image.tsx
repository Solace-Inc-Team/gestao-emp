import { ImageResponse } from "next/og";
import { CHAMA, GOTA } from "@/components/logo";

// imagem que aparece quando o link do site é colado no WhatsApp, LinkedIn etc.: a mesma prancha do topo
export const alt = "Depósito: gestão para revendas de água e gás";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const papel = "#f4f3ee";
const tinta = "#1747c6";
const texto = "#171717";

export default function Image() {
  const traco = { fill: "none", stroke: tinta, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const mono = { fontFamily: "monospace", fontSize: 16, letterSpacing: 2, color: tinta, textTransform: "uppercase" } as const;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: papel, padding: "72px 80px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="44" height="44" viewBox="0 0 24 24">
              <path d={GOTA} fill={tinta} />
              <path d={CHAMA} fill="#f5a524" stroke={papel} strokeWidth="1.5" paintOrder="stroke" />
            </svg>
            <span style={{ fontSize: 30, fontWeight: 700, color: texto, letterSpacing: -0.5 }}>Depósito</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 76, fontWeight: 700, color: texto, lineHeight: 1.02, letterSpacing: -3 }}>Do pedido ao acerto, sem conta de cabeça.</span>
            <span style={{ marginTop: 22, fontSize: 26, color: "#555", lineHeight: 1.35 }}>
              Pedidos, entregas, botijões cheios e vazios e o dinheiro de cada entregador.
            </span>
          </div>
        </div>

        {/* botijão P13 em traço, com cota de altura e a etiqueta de entrega */}
        <svg width="330" height="470" viewBox="0 0 320 420" style={{ position: "absolute", right: 70, top: 80 }}>
          <path {...traco} d="M108 112 V64 C108 52 116 46 128 46 H192 C204 46 212 52 212 64 V112" />
          <rect {...traco} x="120" y="58" width="30" height="13" rx="6.5" />
          <rect {...traco} x="170" y="58" width="30" height="13" rx="6.5" />
          <rect {...traco} x="150" y="84" width="20" height="24" rx="2" />
          <rect {...traco} x="145" y="77" width="30" height="8" rx="2" />
          <path {...traco} d="M80 146 C80 116 120 108 160 108 C200 108 240 116 240 146 V312 C240 336 206 346 160 346 C114 346 80 336 80 312 Z" />
          <path {...traco} d="M80 228 C120 236 200 236 240 228" />
          <path {...traco} d="M100 340 V372 H220 V340" />
          <rect {...traco} x="116" y="354" width="20" height="9" rx="4.5" />
          <rect {...traco} x="184" y="354" width="20" height="9" rx="4.5" />
          <rect {...traco} x="110" y="170" width="100" height="40" rx="3" strokeDasharray="5 5" strokeWidth="1.4" />
          <path {...traco} strokeWidth="1.4" d="M268 46 V372 M263 46 H273 M263 372 H273" />
          <path {...traco} d="M135 64 C128 86 116 102 106 118" strokeWidth="1.6" />
          <path d="M64 118 H162 L172 128 V170 H64 Z" fill={papel} stroke={tinta} strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <div style={{ position: "absolute", right: 216, top: 222, display: "flex", flexDirection: "column", ...mono, fontSize: 14, letterSpacing: 1.5, lineHeight: 1.35 }}>
          <span style={{ fontWeight: 700 }}>#128</span>
          <span>Ana Ribeiro</span>
        </div>
      </div>
    ),
    size,
  );
}
