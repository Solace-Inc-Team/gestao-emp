export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-fg">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="var(--marca)" />
        <path d="M12 5.5c2.7 3.2 4.2 5.5 4.2 7.6a4.2 4.2 0 0 1-8.4 0c0-2.1 1.5-4.4 4.2-7.6z" fill="var(--gota)" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">Depósito</span>
    </span>
  );
}
