// Símbolo "gota-chama": a gota d'água azul com a chama do gás acesa dentro, separadas por um respiro da
// cor do fundo. No nome, o acento do "ó" é uma faísca âmbar. Os mesmos traços estão em app/icon.svg.
export const GOTA = "M12 1.6C12 1.6 4.5 9.4 4.5 15.2a7.5 7.5 0 0 0 15 0C19.5 9.4 12 1.6 12 1.6Z";
export const CHAMA =
  "M12 9.4c2 2.4 3.5 4.3 3.5 6.8a3.5 3.5 0 0 1-7 0c0-1.4.7-2.7 1.8-3.7.1 1.2.6 2 1.3 2.4-.2-1.9-.1-3.7.4-5.5Z";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="logo inline-flex items-center gap-2 text-fg">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 overflow-visible">
        <path d={GOTA} fill="var(--marca)" />
        <path d={CHAMA} fill="var(--chama)" stroke="var(--gota)" strokeWidth={1.5} paintOrder="stroke" className="logo-chama" />
      </svg>
      <span className="sr-only">Depósito</span>
      <span aria-hidden="true" className="text-[15px] font-semibold tracking-tight">
        Dep
        <span className="relative">
          o<span className="logo-acento" />
        </span>
        sito
      </span>
    </span>
  );
}
