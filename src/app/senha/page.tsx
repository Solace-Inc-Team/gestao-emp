import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { changePasswordAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Logo } from "@/components/logo";

export const metadata = { title: "Trocar senha" };

export default async function Senha() {
  const user = await requireUser();
  const back = user.platformAdmin ? "/admin" : user.role === "entregador" ? "/entregador" : "/";
  return (
    <main className="mx-auto max-w-sm px-6 py-12">
      <Logo />
      <h1 className="h1 mt-8 mb-1">Trocar senha</h1>
      <p className="mb-6 text-ink-soft">{user.email}</p>
      <ActionForm action={changePasswordAction} className="space-y-4" reset>
        <div>
          <label className="label" htmlFor="current">Senha atual</label>
          <input id="current" name="current" type="password" autoComplete="current-password" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="next">Nova senha</label>
          <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Repita a nova senha</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        <button className="btn btn-primary w-full">Salvar nova senha</button>
      </ActionForm>
      <Link href={back} className="mt-6 inline-block text-water hover:underline">Voltar</Link>
    </main>
  );
}
