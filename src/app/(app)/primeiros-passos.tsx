import Link from "next/link";
import { Check } from "lucide-react";

// O que uma empresa nova precisa fazer, na ordem em que faz sentido. Cada passo se completa
// sozinho quando a coisa existe no sistema; o bloco some quando todos estão feitos.

type Feito = { produtos: boolean; estoque: boolean; equipe: boolean; pix: boolean; turno: boolean; pedido: boolean };

const passos: { chave: keyof Feito; titulo: string; texto: string; href: string; acao: string }[] = [
  { chave: "produtos", titulo: "Cadastre os produtos e preços", texto: "Gás, galão, o que você vende. O preço do pedido sempre vem daqui.", href: "/produtos", acao: "Cadastrar produtos" },
  { chave: "estoque", titulo: "Lance o estoque inicial", texto: "Quantos cheios e vazios tem na loja hoje. Use a entrada de compra ou o inventário.", href: "/estoque", acao: "Lançar estoque" },
  { chave: "equipe", titulo: "Adicione os entregadores", texto: "Cada um entra com o próprio e-mail e vê só as entregas dele no celular.", href: "/equipe", acao: "Adicionar equipe" },
  { chave: "pix", titulo: "Informe a chave Pix", texto: "Para o QR sair com o valor certo no celular do entregador e no pedido pelo site.", href: "/configuracoes/pagamentos", acao: "Informar chave" },
  { chave: "turno", titulo: "Abra o primeiro turno", texto: "Com o troco inicial, o entregador pode receber pedidos.", href: "/caixa", acao: "Abrir turno" },
  { chave: "pedido", titulo: "Lance o primeiro pedido", texto: "Do telefone ao acerto: daqui em diante é o dia a dia.", href: "/pedidos/novo", acao: "Novo pedido" },
];

export function PrimeirosPassos({ feito }: { feito: Feito }) {
  const prontos = passos.filter((p) => feito[p.chave]).length;
  if (prontos === passos.length) return null;
  const proximo = passos.find((p) => !feito[p.chave])!;
  return (
    <section aria-labelledby="primeiros-passos" className="panel mb-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="primeiros-passos" className="h2">Primeiros passos</h2>
        <span className="num text-sm text-muted">
          {prontos} de {passos.length}
        </span>
      </div>
      <div className="h-0.5 bg-subtle" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${(prontos / passos.length) * 100}%` }} />
      </div>
      <ol>
        {passos.map((p, i) => {
          const ok = feito[p.chave];
          const atual = p === proximo;
          return (
            <li key={p.chave} className={`flex items-start gap-3 border-b border-line px-4 py-3 last:border-0 ${atual ? "bg-subtle/60" : ""}`}>
              <span
                aria-hidden="true"
                className={`num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                  ok ? "bg-ok-soft text-ok" : atual ? "bg-fg text-bg" : "border border-line text-muted"
                }`}
              >
                {ok ? <Check size={14} strokeWidth={2.5} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={ok ? "text-muted" : "font-medium"}>
                  {p.titulo}
                  {ok && <span className="sr-only"> (feito)</span>}
                </p>
                {atual && (
                  <>
                    <p className="mt-0.5 text-sm text-muted">{p.texto}</p>
                    {/* no celular o botão desce para a linha de baixo, em vez de espremer o texto */}
                    <Link href={p.href} className="btn btn-primary mt-3 w-full sm:hidden">
                      {p.acao}
                    </Link>
                  </>
                )}
              </div>
              {atual ? (
                <Link href={p.href} className="btn btn-primary hidden h-8 shrink-0 text-[13px] sm:inline-flex">
                  {p.acao}
                </Link>
              ) : (
                !ok && (
                  <Link href={p.href} className="shrink-0 text-sm text-accent hover:underline">
                    {p.acao}
                  </Link>
                )
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
