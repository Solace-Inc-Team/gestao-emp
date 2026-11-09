export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${light ? "text-white" : "text-ink"}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect x="2" y="7" width="12" height="18" rx="3" fill="#1769d1" />
        <rect x="5" y="3" width="6" height="5" rx="1.5" fill="#1769d1" />
        <path d="M21 25c-3.6 0-6-2.4-6-5.6 0-3.4 3-5.4 3.6-9.4 2.8 1.8 4 4 4 6 1-.6 1.6-1.6 1.8-2.6 1.6 1.6 2.6 3.6 2.6 6 0 3.2-2.4 5.6-6 5.6z" fill="#e09f1f" />
      </svg>
      <span className="font-[family-name:var(--font-cond)] text-2xl font-bold tracking-tight">Depósito</span>
    </span>
  );
}
