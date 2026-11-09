"use client";

import { useState, useTransition, type ReactNode } from "react";

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
          if (!r?.error && reset) form.reset();
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && (
        <p role="alert" className="mt-2 basis-full rounded-md bg-short-soft px-3 py-2 text-sm font-medium text-short">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="mt-2 basis-full text-sm font-medium text-over">
          {state.ok}
        </p>
      )}
    </form>
  );
}
