import Link from "next/link";
import { redirect } from "next/navigation";
import { TemaBotao } from "@/components/tema-botao";
import { getUser } from "@/lib/auth";
import { login } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { MarcaDaSessao } from "@/components/logo";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(user.platformAdmin ? "/admin" : user.role === "entregador" ? "/entregador" : "/");
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center px-6 py-16">
      {/* o mesmo padrão da página inicial: fundo limpo e só a luz da marca vindo de cima, nada desenhado */}
      <div aria-hidden="true" className="topo-luz absolute inset-0 -z-10" />
      <div className="w-full max-w-[22rem]">
        <div className="stagger">
          <div className="flex justify-center">
            <MarcaDaSessao size={28} />
          </div>
          <h1 className="mt-8 text-center text-[1.75rem] leading-tight font-semibold tracking-[-0.03em]">Entrar</h1>
          <p className="mt-1.5 text-center text-muted">Acesse o sistema da sua revenda.</p>
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
          <p className="mt-4 text-center text-[13px] text-muted">Esqueceu a senha? Peça ao dono da empresa para redefinir. Se você é o dono, fale com a Solace.</p>
          {process.env.SEED_DEMO === "true" && (
            <div className="mt-10 rounded-xl border border-line bg-surface/60 p-4 text-[13px] text-muted">
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
      </div>
      <footer className="mt-16 flex items-center gap-4 text-xs text-muted">
        <span>Solace</span>
        <Link href="/termos" className="alvo hover:text-fg">Termos de uso</Link>
        <Link href="/privacidade" className="alvo hover:text-fg">Privacidade</Link>
        <TemaBotao className="size-10 sm:size-8" />
      </footer>
    </main>
  );
}
