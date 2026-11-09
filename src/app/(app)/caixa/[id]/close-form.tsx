"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { closeShiftAction } from "@/app/actions";
import { parseBRL } from "@/lib/money";
import { Difference } from "@/components/ui";

export function CloseShiftForm({ shiftId, expectedCents }: { shiftId: string; expectedCents: number }) {
  const [counted, setCounted] = useState("");
  const c = parseBRL(counted);
  const diff = c === null ? null : c - expectedCents;
  return (
    <ActionForm action={closeShiftAction} className="space-y-3" confirm="Fechar o acerto? Depois de fechado, o resultado não pode ser alterado.">
      <input type="hidden" name="shiftId" value={shiftId} />
      <div>
        <label className="label" htmlFor="counted">Dinheiro contado</label>
        <input
          id="counted"
          name="counted"
          inputMode="decimal"
          required
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          className="input h-14 font-[family-name:var(--font-cond)] text-3xl"
          placeholder="0,00"
        />
      </div>
      <p aria-live="polite" className="min-h-7 text-lg">
        {diff !== null && <Difference cents={diff} />}
      </p>
      <div>
        <label className="label" htmlFor="notes">Observação {diff ? "(obrigatória quando há diferença)" : "(opcional)"}</label>
        <textarea id="notes" name="notes" rows={3} className="input" required={!!diff} />
      </div>
      <button className="btn btn-primary w-full">Fechar acerto</button>
    </ActionForm>
  );
}
