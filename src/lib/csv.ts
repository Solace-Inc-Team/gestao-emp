// CSV no formato que o Excel em português abre direto: ";" como separador e BOM UTF-8.

const brDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : v instanceof Date ? brDateTime.format(v) : String(v);
  // prefixo ' evita que o Excel interprete como fórmula; número negativo puro passa direto
  const safe = /^[=+\-@]/.test(s) && !/^-\d+(,\d+)?$/.test(s) ? `'${s}` : s;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const toCsv = (header: string[], rows: unknown[][]) =>
  "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");

/** centavos → "12,50" */
export const reais = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","));
