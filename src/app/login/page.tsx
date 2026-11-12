import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { login } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Logo } from "@/components/logo";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(user.platformAdmin ? "/admin" : user.role === "entregador" ? "/entregador" : "/");
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora aurora-agua" />
        <div className="aurora aurora-chama" />
        <div className="hero-grid absolute inset-0" />
        <div className="noise absolute inset-0" />
      </div>
      <div className="stagger w-full max-w-[22rem]">
        <Logo size={28} />
        <h1 className="mt-8 text-[1.75rem] leading-tight font-semibold tracking-[-0.03em]">Entrar</h1>
        <p className="mt-1.5 text-muted">Pedidos, entregas, estoque e acerto de caixa da sua distribuidora.</p>
        <ActionForm action={login} className="mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="username" required className="input h-11" />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input h-11" />
          </div>
          <button className="btn btn-primary h-11 w-full">Entrar</button>
        </ActionForm>
        <p className="mt-4 text-[13px] text-muted">Esqueceu a senha? Peça ao dono da empresa para redefinir. Se você é o dono, fale com a Solace.</p>
        {process.env.SEED_DEMO === "true" && (
          <div className="mt-10 border-t border-line pt-6 text-[13px] text-muted">
            <p className="mb-2 font-medium text-fg">Acessos de demonstração</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt>Dono</dt>
              <dd className="text-fg">dono@demo.com</dd>
              <dt>Atendente</dt>
              <dd className="text-fg">atendente@demo.com</dd>
              <dt>Caixa</dt>
              <dd className="text-fg">caixa@demo.com</dd>
              <dt>Entregador</dt>
              <dd className="text-fg">joao@demo.com</dd>
              <dt>Senha</dt>
              <dd className="text-fg">demo1234</dd>
            </dl>
          </div>
        )}
      </div>
      <footer className="mt-16 flex gap-4 text-xs text-muted">
        <span>Solace</span>
        <Link href="/termos" className="hover:text-fg">Termos de uso</Link>
        <Link href="/privacidade" className="hover:text-fg">Privacidade</Link>
      </footer>
    </main>
  );
}
