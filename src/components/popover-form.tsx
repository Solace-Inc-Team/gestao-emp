"use client";

import type { ReactNode } from "react";
import { ActionForm, type ActionState } from "./action-form";

/** Ação de linha que pede um dado antes (motivo, senha nova): abre um formulário pequeno ancorado no link. */
export function PopoverForm({
  label,
  action,
  submit,
  danger = false,
  align = "right",
  confirm,
  children,
}: {
  label: string;
  action: (fd: FormData) => Promise<ActionState>;
  submit: string;
  danger?: boolean;
  align?: "left" | "right";
  confirm?: string;
  children: ReactNode;
}) {
  return (
    <details
      className="relative inline-block text-left"
      onKeyDown={(e) => {
        if (e.key === "Escape") e.currentTarget.open = false;
      }}
    >
      <summary className="tap cursor-pointer list-none whitespace-nowrap text-[13px] text-muted hover:text-fg">{label}</summary>
      <ActionForm
        action={action}
        confirm={confirm}
        className={`popover ${align === "left" ? "popover-left left-0" : "right-0"} absolute z-10 mt-2 flex w-64 flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-left shadow-[0_8px_30px_rgb(0_0_0/0.12)]`}
      >
        {children}
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`}>{submit}</button>
      </ActionForm>
    </details>
  );
}
