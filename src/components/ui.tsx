import type { ReactNode } from "react";
import { formatBRL } from "@/lib/money";

const statusStyle = {
  aberto: ["Aguardando", "bg-warn"],
  em_rota: ["Em rota", "bg-accent"],
  entregue: ["Entregue", "bg-ok"],
  cancelado: ["Cancelado", "bg-muted/50"],
  estornado: ["Estornado", "bg-danger"],
} as const;

export function StatusBadge({ status }: { status: keyof typeof statusStyle }) {
  const [label, dot] = statusStyle[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot} ${status === "aberto" || status === "em_rota" ? "pulse-dot" : ""}`} />
      <span className={status === "cancelado" || status === "estornado" ? "text-muted" : ""}>{label}</span>
    </span>
  );
}

export const paymentLabel = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão", fiado: "Fiado" } as const;
export const roleLabel = { dono: "Dono", atendente: "Atendente", caixa: "Caixa", entregador: "Entregador" } as const;

export function Money({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={`num ${className}`}>{formatBRL(cents)}</span>;
}

/** ✓ que se desenha ao aparecer (acerto que bateu). */
export function CheckDrawn({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`check-draw shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="10" />
      <path d="m7.5 12.5 3 3 6-6.5" />
    </svg>
  );
}

export function Difference({ cents, className = "" }: { cents: number; className?: string }) {
  const color = cents < 0 ? "text-danger" : cents > 0 ? "text-ok" : "text-muted";
  const label = cents < 0 ? "falta " : cents > 0 ? "sobra " : "";
  return (
    <span className={`num font-semibold ${color} ${className}`}>
      {cents === 0 ? "sem diferença" : `${label}${formatBRL(Math.abs(cents))}`}
    </span>
  );
}

/** Pedido feito pelo próprio cliente no portal. */
export const SiteBadge = () => <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">Site</span>;

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h1">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center text-muted">
      {/* galão vazio em desenho técnico: a linha tracejada é o nível que não tem */}
      <svg viewBox="0 0 40 48" className="ink mx-auto mb-3 h-12 w-10 opacity-80" aria-hidden="true">
        <path pathLength={1} d="M15 4 H25 V9 H15 Z" />
        <path pathLength={1} d="M17 13 C9 14 6 17 6 21 V40 C6 43 8 44 11 44 H29 C32 44 34 43 34 40 V21 C34 17 31 14 23 13 V9 M17 9 V13" />
        <path pathLength={1} d="M10 39 H30" className="tracejado" />
      </svg>
      <p>{children}</p>
    </div>
  );
}

/** Cabeçalho interno de painel: título à esquerda, ação ou link à direita. */
const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const tm = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" });
export const fmtDateTime = (d: Date | null) => (d ? dt.format(d) : "-");
export const fmtTime = (d: Date | null) => (d ? tm.format(d) : "-");
