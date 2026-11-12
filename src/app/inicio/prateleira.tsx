// O motivo da página: o estoque. Uma fileira de vasilhames em linha, galão e botijão alternados,
// por onde passa uma onda que esvazia e enche cada um: saiu cheio, voltou vazio.
// Sem movimento pedido, a fileira fica parada com cheios e vazios misturados.

function Galao() {
  return (
    <>
      <path d="M8 2.5h6M8.5 2.5v3.5h5V2.5" />
      <rect x="2.5" y="6" width="17" height="25" rx="4.5" />
    </>
  );
}

function Botijao() {
  return (
    <>
      <path d="M6.5 7.5V4.5a1.5 1.5 0 0 1 1.5-1.5h6a1.5 1.5 0 0 1 1.5 1.5v3" />
      <rect x="2.5" y="7.5" width="17" height="21" rx="7" />
      <path d="M5 28.5v2.5h12v-2.5" />
    </>
  );
}

export function Prateleira({ quantos = 14, className = "" }: { quantos?: number; className?: string }) {
  return (
    // a linha embaixo é a própria prateleira: sem ela os vasilhames soltos parecem pilhas
    <div aria-hidden="true" className={`prateleira flex items-end gap-2.5 overflow-hidden border-b border-current/40 pb-1.5 ${className}`}>
      {Array.from({ length: quantos }, (_, i) => {
        const galao = i % 2 === 0;
        return (
          <svg key={i} viewBox="0 0 22 32" className="vasilhame h-11 w-[30px] shrink-0" style={{ "--i": i } as React.CSSProperties}>
            {/* o nível é o que esvazia e enche; fica atrás do contorno, preso ao fundo */}
            <rect className="nivel" x="4" y={galao ? 9 : 10} width="14" height={galao ? 20.5 : 17} rx="3" data-parado={i % 3 === 1 ? "vazio" : undefined} />
            {galao ? <Galao /> : <Botijao />}
          </svg>
        );
      })}
    </div>
  );
}
