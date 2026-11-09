"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

export type ActionState = { error?: string; ok?: string } | undefined | void;

// onSubmit manual em vez de action={...}: o React limpa o form depois da action, e em caso de erro
// a gente quer manter o que foi digitado
export function ActionForm({
  action,
  children,
  className,
  reset = false,
  confirm,
}: {
  action: (fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  reset?: boolean;
  confirm?: string;
}) {
  const [state, setState] = useState<ActionState>();
  const [pending, start] = useTransition();
  const [seq, setSeq] = useState(0); // remonta o toast a cada envio, mesmo com a mesma mensagem
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const r = await action(fd);
          setState(r);
          setSeq((n) => n + 1);
          if (!r?.error && reset) form.reset();
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && (
        <p role="alert" className="mt-2 flex basis-full items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
          <CircleAlert size={16} strokeWidth={2} className="mt-px shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
      {state?.ok && <Toast key={seq} message={state.ok} />}
    </form>
  );
}

function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <p
      role="status"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-[13px] font-medium shadow-[0_8px_30px_rgb(0_0_0/0.12)]"
    >
      <CircleCheck size={16} strokeWidth={2} className="text-ok" aria-hidden="true" />
      {message}
    </p>
  );
}
