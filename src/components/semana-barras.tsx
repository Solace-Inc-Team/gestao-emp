import { formatBRL } from "@/lib/money";

// Vendido de cada um dos últimos 7 dias, em barras pequenas: o dia escolhido em azul, os outros neutros.
// Uma série só, então sem legenda; o valor aparece ao passar o mouse e há uma lista para leitor de tela.

const dia = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" })
    .format(new Date(`${iso}T12:00:00-03:00`))
    .replace(".", "");

export function SemanaBarras({ semana }: { semana: { day: string; cents: number }[] }) {
  const max = Math.max(...semana.map((d) => d.cents), 1);
  const ultimo = semana.length - 1;
  return (
    <figure className="mt-4">
      <div aria-hidden="true" className="flex h-10 items-end gap-0.5">
        {semana.map((d, i) => (
          <div key={d.day} className="semana-barra group relative flex h-full flex-1 items-end" data-atual={i === ultimo || undefined}>
            <span
              className="w-full rounded-t-[4px]"
              // dia sem venda ainda deixa um traço na base, para a semana não ter buraco
              style={{ height: d.cents ? `${Math.max((d.cents / max) * 100, 6)}%` : "2px" }}
            />
            <span className="semana-dica num">{formatBRL(d.cents)}</span>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1 flex gap-0.5">
        {semana.map((d, i) => (
          <span key={d.day} className={`flex-1 text-center text-[10.5px] ${i === ultimo ? "font-medium text-fg" : "text-muted"}`}>
            {dia(d.day)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        Vendido nos últimos 7 dias:{" "}
        {semana.map((d) => `${dia(d.day)} ${formatBRL(d.cents)}`).join(", ")}
      </figcaption>
    </figure>
  );
}
