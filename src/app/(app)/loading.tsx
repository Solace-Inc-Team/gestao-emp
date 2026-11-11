// enquanto a tela busca os dados: o formato da página, sem números
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton mt-2 h-7 w-56" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel p-5">
            <div className="skeleton h-3.5 w-24" />
            <div className="skeleton mt-3 h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="panel mt-6 divide-y divide-line">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="skeleton h-3.5 w-10" />
            <div className="skeleton h-3.5 flex-1" />
            <div className="skeleton h-3.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
