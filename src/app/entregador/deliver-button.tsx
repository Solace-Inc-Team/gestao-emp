"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { deliverAction } from "@/app/actions";
import { toast } from "@/components/action-form";

const WAIT = 5;
const QUEUE = "deposito:entregas-a-enviar";

// entregas confirmadas sem internet ficam guardadas no aparelho até a conexão voltar
const queued = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE) ?? "[]");
  } catch {
    return [];
  }
};
const setQueued = (ids: string[]) => {
  try {
    localStorage.setItem(QUEUE, JSON.stringify(ids));
  } catch {
    // aparelho sem armazenamento: a confirmação só não sobrevive a fechar a tela
  }
};

/** "Entreguei" só vale depois de 5 segundos: dá tempo de desfazer um toque no card errado. */
export function DeliverButton({ orderId, label }: { orderId: string; label: string }) {
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [waitingNetwork, setWaitingNetwork] = useState(false);
  const [pending, start] = useTransition();

  const send = useCallback(() => {
    const fd = new FormData();
    fd.set("orderId", orderId);
    start(async () => {
      try {
        const r = await deliverAction(fd);
        setQueued(queued().filter((id) => id !== orderId));
        setWaitingNetwork(false);
        setError(r?.error);
        if (r?.ok) toast(r.ok);
      } catch {
        // sem resposta do servidor: guarda e tenta de novo. Repetir é seguro, o servidor não confirma duas vezes
        setQueued([...new Set([...queued(), orderId])]);
        setWaitingNetwork(true);
      }
      setLeft(null);
    });
  }, [orderId]);

  useEffect(() => {
    if (queued().includes(orderId)) send();
  }, [orderId, send]);

  useEffect(() => {
    if (!waitingNetwork) return;
    const t = setInterval(send, 15000);
    window.addEventListener("online", send);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", send);
    };
  }, [waitingNetwork, send]);

  // fechar a tela no meio da contagem perderia a confirmação; e os outros cards ficam travados para não confirmar dois de uma vez
  useEffect(() => {
    if (!left) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    document.body.dataset.confirmando = "1";
    return () => {
      window.removeEventListener("beforeunload", warn);
      delete document.body.dataset.confirmando;
    };
  }, [left]);

  useEffect(() => {
    if (left === null) return;
    if (left === 0) {
      send();
      return;
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, send]);

  if (waitingNetwork)
    return (
      <p role="status" className="rounded-lg bg-warn-soft px-3 py-3 text-[15px] text-warn-fg">
        Sem internet. A entrega está guardada neste celular e será confirmada sozinha quando a conexão voltar.
      </p>
    );

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
        className="btn btn-primary deliver-btn h-12 w-full text-[15px]"
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
