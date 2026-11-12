import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getPendingMfa } from "@/lib/auth";
import { verifyMfaAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { MarcaDaSessao } from "@/components/logo";

export const metadata = { title: "Código de verificação" };

export default async function Codigo() {
  if (!(await getPendingMfa())) redirect("/login");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-[22rem]">
        <MarcaDaSessao size={28} />
        <ShieldCheck size={28} strokeWidth={1.5} className="mt-8 text-muted" aria-hidden="true" />
        <h1 className="mt-3 text-[1.75rem] leading-tight font-semibold tracking-[-0.03em]">Código de verificação</h1>
        <p className="mt-1.5 text-muted">Abra o app autenticador e digite o código de 6 dígitos do Depósito.</p>
        <ActionForm action={verifyMfaAction} className="mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="code">Código</label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              required
              autoFocus
              className="input num h-12 text-center text-xl tracking-[0.3em]"
            />
          </div>
          <button className="btn btn-primary h-11 w-full">Confirmar</button>
        </ActionForm>
        <p className="mt-4 text-[13px] text-muted">Perdeu o celular ou trocou de aparelho? Peça ao dono da empresa para redefinir seu acesso (se você é o dono, fale com a Solace). A verificação em duas etapas é desligada e você ativa de novo no aparelho novo.</p>
        <Link href="/login" className="mt-6 inline-block text-[13px] text-muted hover:text-fg">Voltar ao login</Link>
      </div>
    </main>
  );
}
