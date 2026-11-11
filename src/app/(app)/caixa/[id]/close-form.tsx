"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { closeShiftAction } from "@/app/actions";
import { formatBRL, parseBRL } from "@/lib/money";
import { LiveNumber } from "@/components/live-number";
import { CheckDrawn } from "@/components/ui";

export function CloseShiftForm({ shiftId, expectedCents }: { shiftId: string; expectedCents: number }) {
  const [counted, setCounted] = useState("");
  const c = parseBRL(counted);
  const diff = c === null ? null : c - expectedCents;
  return (
    <ActionForm action={closeShiftAction} className="space-y-3" confirm={
        c === null
          ? undefined
          : `Contado ${formatBRL(c)}, esperado ${formatBRL(expectedCents)}: ${diff === 0 ? "bateu" : diff! < 0 ? `falta ${formatBRL(-diff!)}` : `sobra ${formatBRL(diff!)}`}. Fechar o acerto? Depois não dá para mudar.`
      }>
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
          className="input h-14 text-3xl"
          placeholder="0,00"
        />
      </div>
      <p aria-live="polite" className="min-h-9 text-lg">
        {diff !== null && (
          // a cor acompanha: verde quando bate, amarelo se sobra, vermelho se falta
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-colors duration-300 ${
              diff === 0 ? "bg-ok-soft text-ok" : diff < 0 ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn-fg"
            }`}
          >
            {diff === 0 ? (
              <>
                <CheckDrawn className="size-5" /> bateu, sem diferença
              </>
            ) : (
              <>
                {diff < 0 ? "falta" : "sobra"} <LiveNumber value={Math.abs(diff)} cents />
              </>
            )}
          </span>
        )}
      </p>
      <div>
        <label className="label" htmlFor="notes">Observação {diff ? "(obrigatória quando há diferença)" : "(opcional)"}</label>
        <textarea id="notes" name="notes" rows={3} className="input" required={!!diff} />
      </div>
      <button className="btn btn-primary w-full">Fechar acerto</button>
    </ActionForm>
  );
}
