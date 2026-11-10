"use client";

import { useEffect, useState, useTransition } from "react";
import { deliverAction } from "@/app/actions";
import { toast } from "@/components/action-form";

const WAIT = 5;

/** "Entreguei" só vale depois de 5 segundos: dá tempo de desfazer um toque no card errado. */
export function DeliverButton({ orderId, label }: { orderId: string; label: string }) {
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (left === null) return;
    if (left === 0) {
      const fd = new FormData();
      fd.set("orderId", orderId);
      start(async () => {
        const r = await deliverAction(fd);
        setLeft(null);
        setError(r?.error);
        if (r?.ok) toast(r.ok);
      });
      return;
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, orderId]);

  if (left !== null && left > 0)
    return (
      <div className="flex items-center gap-3" role="status">
        <p className="flex-1 text-[15px]">Confirmando em {left}s…</p>
        <button type="button" className="btn h-12 px-5 text-[15px]" onClick={() => setLeft(null)}>
          Desfazer
        </button>
      </div>
    );

  return (
    <>
      <button
        type="button"
        disabled={pending || left === 0}
        onClick={() => {
          setError(undefined);
          setLeft(WAIT);
        }}
        className="btn btn-primary h-12 w-full text-[15px]"
      >
        {pending || left === 0 ? "Confirmando…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </>
  );
}
