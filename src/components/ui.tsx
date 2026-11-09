import type { ReactNode } from "react";
import { formatBRL } from "@/lib/money";

const statusStyle = {
  aberto: ["Aguardando", "bg-gas-soft text-[#8a5c00]"],
  em_rota: ["Em rota", "bg-water-soft text-water"],
  entregue: ["Entregue", "bg-over-soft text-over"],
  cancelado: ["Cancelado", "bg-[#eceff3] text-ink-soft line-through"],
} as const;

export function StatusBadge({ status }: { status: keyof typeof statusStyle }) {
  const [label, cls] = statusStyle[status];
  return <span className={`inline-block rounded px-2 py-0.5 text-sm font-semibold ${cls}`}>{label}</span>;
}

export const paymentLabel = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão", fiado: "Fiado" } as const;
export const roleLabel = { dono: "Dono", atendente: "Atendente", entregador: "Entregador" } as const;

export function Money({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={`num ${className}`}>{formatBRL(cents)}</span>;
}

export function Difference({ cents, className = "" }: { cents: number; className?: string }) {
  const color = cents < 0 ? "text-short" : cents > 0 ? "text-over" : "text-ink-soft";
  const label = cents < 0 ? "falta " : cents > 0 ? "sobra " : "";
  return (
    <span className={`num font-semibold ${color} ${className}`}>
      {cents === 0 ? "sem diferença" : `${label}${formatBRL(Math.abs(cents))}`}
    </span>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="h1">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-ink-soft">{children}</p>;
}

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const tm = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" });
export const fmtDateTime = (d: Date | null) => (d ? dt.format(d) : "-");
export const fmtTime = (d: Date | null) => (d ? tm.format(d) : "-");
