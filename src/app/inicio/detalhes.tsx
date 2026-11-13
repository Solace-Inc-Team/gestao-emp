import { Check, FileSpreadsheet, Lock, RotateCcw } from "lucide-react";

// Pedaços reais das telas do sistema para o mosaico da página inicial, no lugar de esquemas
// desenhados: cada um mostra a coisa acontecendo como acontece no produto. As animações são
// em CSS (classes mini-*), em volta lenta, e só andam com o bloco na tela.

/** Estorno: o pedido pede a senha de quem está logado e vira uma linha no histórico. */
export function MiniEstorno() {
  return (
    <div className="mini" aria-hidden="true">
      <div className="flex items-center justify-between">
        <span className="font-medium">Estornar pedido #58</span>
        <span className="num text-muted">R$ 115,00</span>
      </div>
      <p className="mt-3 text-[11px] text-muted">Sua senha, para confirmar</p>
      <div className="mini-campo mt-1">
        <span className="mini-senha">••••••••</span>
      </div>
      <div className="mini-registro mt-3 flex items-center gap-2 rounded-md bg-subtle px-2.5 py-2">
        <RotateCcw size={13} strokeWidth={2} className="shrink-0 text-muted" />
        <span className="min-w-0 truncate">
          Estornado por Marina, 14:32
        </span>
      </div>
    </div>
  );
}

/** Isolamento: os pedidos da sua revenda aparecem; o que é de outra nem chega na tela. */
export function MiniSoSua() {
  return (
    <div className="mini" aria-hidden="true">
      <p className="text-[11px] text-muted">Fonte Azul · pedidos de hoje</p>
      <ul className="mt-2 space-y-1.5">
        {[
          ["#61", "Restaurante Sabor", "R$ 420,00"],
          ["#60", "Diego Alves", "R$ 115,00"],
        ].map(([n, c, v]) => (
          <li key={n} className="flex items-center gap-2">
            <span className="num w-7 text-muted">{n}</span>
            <span className="min-w-0 flex-1 truncate">{c}</span>
            <span className="num">{v}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <Lock size={13} strokeWidth={2} className="mini-cadeado shrink-0 text-muted" />
        <span className="text-[11px] text-muted">Outras revendas</span>
      </div>
      <div className="mt-2 space-y-1.5">
        <span className="mini-tarja block h-2.5 w-[72%] rounded-full" />
        <span className="mini-tarja block h-2.5 w-[54%] rounded-full" />
      </div>
    </div>
  );
}

/** Exportação: um toque e sai a planilha com tudo da empresa. */
export function MiniExportar() {
  return (
    <div className="mini flex flex-wrap items-center gap-3" aria-hidden="true">
      {/* a barra de progresso corre dentro do próprio botão, sem abrir um buraco ao lado */}
      <span className="mini-botao relative overflow-hidden rounded-md border border-line px-2.5 py-1.5 font-medium">
        Exportar todos os dados
        <span className="mini-barra absolute inset-x-0 bottom-0 h-0.5">
          <span className="block h-full bg-accent" />
        </span>
      </span>
      <span className="mini-arquivo flex items-center gap-2 rounded-md bg-subtle px-2.5 py-1.5">
        <FileSpreadsheet size={14} strokeWidth={1.75} className="text-accent" />
        fonte-azul-dados.zip
        <span className="text-muted">· 6 planilhas</span>
        <Check size={13} strokeWidth={2.5} className="text-ok" />
      </span>
    </div>
  );
}
