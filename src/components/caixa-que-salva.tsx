"use client";

/** Caixa de seleção que salva sozinha ao marcar ou desmarcar: envia o formulário em volta (um ActionForm). */
export function CaixaQueSalva({ name, defaultChecked }: { name: string; defaultChecked: boolean }) {
  return <input type="checkbox" name={name} defaultChecked={defaultChecked} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
