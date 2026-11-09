// Datas de filtro em horário de Brasília (sem horário de verão desde 2019).
const iso = (d: Date) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);

export function parsePeriod(sp: Record<string, string | string[] | undefined>) {
  const ok = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const today = iso(new Date());
  const fromStr = ok(sp.de) ? (sp.de as string) : iso(new Date(Date.now() - 6 * 864e5));
  const toStr = ok(sp.ate) ? (sp.ate as string) : today;
  const from = new Date(`${fromStr}T00:00:00-03:00`);
  const to = new Date(new Date(`${toStr}T00:00:00-03:00`).getTime() + 864e5); // fim exclusivo
  return { fromStr, toStr, from, to };
}
