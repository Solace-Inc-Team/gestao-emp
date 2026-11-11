"use client";

import { useState } from "react";

/** Campo de contagem que já mostra a diferença para o sistema, antes de pedir a senha. */
export function CountInput({ name, label, expected }: { name: string; label: string; expected: number }) {
  const [value, setValue] = useState("");
  const diff = value === "" || !Number.isInteger(Number(value)) ? 0 : Number(value) - expected;
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-[13px] text-muted">sistema: {expected}</span>
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        max={100000}
        aria-label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input num w-20 text-right"
      />
      <span aria-live="polite" className={`num w-10 text-left text-[13px] font-semibold ${diff < 0 ? "text-danger" : "text-ok"}`}>
        {diff ? (diff > 0 ? `+${diff}` : diff) : ""}
      </span>
    </div>
  );
}
