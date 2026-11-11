// formato da tela do entregador enquanto carrega: cabeçalho, caixa no topo e dois cartões de entrega
export default function Loading() {
  return (
    <div className="mx-auto min-h-screen max-w-lg" aria-busy="true" aria-label="Carregando">
      {/* mesma altura do cabeçalho de verdade, para o conteúdo não pular quando chega */}
      <div className="flex h-[69px] items-center border-b border-line px-4">
        <div className="skeleton h-6 w-28" />
      </div>
      <div className="px-4 py-6">
        <div className="skeleton h-4 w-24" />
        <div className="panel mt-3 p-5">
          <div className="skeleton h-3.5 w-48" />
          <div className="skeleton mt-3 h-10 w-40" />
        </div>
        <div className="skeleton mt-6 mb-3 h-5 w-44" />
        {[0, 1].map((i) => (
          <div key={i} className="panel mb-4 p-4">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton mt-3 h-4 w-full" />
            <div className="skeleton mt-2 h-4 w-2/3" />
            <div className="skeleton mt-4 h-12 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
