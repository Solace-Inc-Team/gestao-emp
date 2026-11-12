import { formatBRL } from "@/lib/money";

type Parte = { rotulo: string; cents: number };

// uma cor só, do mais forte (dinheiro na mão) ao mais apagado (fiado, que ainda não entrou)
const tons = ["bg-marca", "bg-marca/60", "bg-marca/35", "bg-muted/40"];

/**
 * Uma barra fina dividida na proporção de cada forma de pagamento, com o nome, o valor e a parte
 * de cada uma embaixo. Os trechos se desenham da esquerda para a direita quando a tela abre.
 */
export function DivisaoPagamento({ partes, className = "" }: { partes: Parte[]; className?: string }) {
  const total = partes.reduce((s, p) => s + p.cents, 0);
  if (total <= 0) return null;
  const comCor = partes.map((p, i) => ({ ...p, tom: tons[i % tons.length] })).filter((p) => p.cents > 0);
  return (
    <figure className={className}>
      <div className="divisao flex h-2 gap-0.5" aria-hidden="true">
        {comCor.map((p, i) => (
          <span key={p.rotulo} className={`rounded-full ${p.tom}`} style={{ flexGrow: p.cents, "--i": i } as React.CSSProperties} />
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
        {comCor.map((p) => (
          <span key={p.rotulo} className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${p.tom}`} aria-hidden="true" />
            <span className="text-muted">{p.rotulo}</span>
            <span className="num font-medium">{formatBRL(p.cents)}</span>
            <span className="num text-muted">{Math.round((p.cents / total) * 100)}%</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
