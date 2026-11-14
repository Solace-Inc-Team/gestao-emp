"use client";

import { useState } from "react";
import { ActionForm } from "./action-form";
import { partialDeliveryAction } from "@/app/actions";
import { LiveNumber } from "@/components/live-number";
import { partialDiscount } from "@/lib/cash";
import { Aparece } from "./saida";

type Item = { id: string; name: string; quantity: number; unitPriceCents: number };
export type PartialOrder = { id: string; deliveryFeeCents: number; discountCents: number; changeForCents: number | null };

/** Entrega parcial com a conta refeita na tela, para o entregador saber quanto cobrar antes de confirmar. */
export function PartialDeliveryForm({ order, items, forDriver }: { order: PartialOrder; items: Item[]; forDriver: boolean }) {
  const [got, setGot] = useState<Record<string, string>>({});
  const qty = (i: Item) => {
    const v = got[i.id];
    const n = v === undefined || v === "" ? NaN : Number(v);
    return Number.isInteger(n) && n >= 0 && n <= i.quantity ? n : null;
  };
  const filled = items.every((i) => qty(i) !== null);
  const subtotal = items.reduce((s, i) => s + (qty(i) ?? 0) * i.unitPriceCents, 0);
  const ordered = items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
  // mesma regra do servidor: desconto proporcional ao que foi entregue
  const total = subtotal + order.deliveryFeeCents - partialDiscount(order.discountCents, ordered, subtotal);
  const change = order.changeForCents && order.changeForCents > total ? order.changeForCents - total : 0;

  return (
    <ActionForm action={partialDeliveryAction} className="mt-2 space-y-3 rounded-lg bg-subtle p-3">
      <input type="hidden" name="orderId" value={order.id} />
      <p className="text-[13px] text-muted">
        Quanto o cliente recebeu de cada item? {forDriver ? "O resto volta com você para a loja." : "O resto fica com o entregador até o acerto."}
      </p>
      {items.map((i) => (
        <div key={i.id} className="flex items-center justify-between gap-3">
          <label htmlFor={`qty-${i.id}`} className="min-w-0 flex-1">
            {i.name} <span className="text-muted">(pedido: {i.quantity})</span>
          </label>
          <input
            id={`qty-${i.id}`}
            name={`qty:${i.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={i.quantity}
            required
            value={got[i.id] ?? ""}
            onChange={(e) => setGot((g) => ({ ...g, [i.id]: e.target.value }))}
            className="input num w-20 text-center"
          />
        </div>
      ))}
      <Aparece quando={filled}>
        <p aria-live="polite" className="rounded-md bg-surface px-3 py-2 font-medium">
          Novo total <LiveNumber value={total} cents />
          {change > 0 && (
            <span className="text-muted">
              , troco <LiveNumber value={change} cents />
            </span>
          )}
        </p>
      </Aparece>
      <div>
        <label className="label" htmlFor={`pnote-${order.id}`}>Por quê</label>
        <input id={`pnote-${order.id}`} name="note" required minLength={3} maxLength={160} className="input" placeholder="Ex.: cliente só quis 1 galão" />
      </div>
      <button className="btn w-full">Registrar entrega parcial</button>
    </ActionForm>
  );
}
