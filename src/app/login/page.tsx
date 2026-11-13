import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { login } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { MarcaDaSessao } from "@/components/logo";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(user.platformAdmin ? "/admin" : user.role === "entregador" ? "/entregador" : "/");
  return (
    <main className="pagina-escura relative isolate flex min-h-screen flex-col items-center justify-center px-6 py-16">
      {/* o mesmo padrão da página inicial: sempre escuro, fundo limpo e só a luz da marca vindo de cima */}
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
          {/* a explicação só aparece para quem precisa: um link curto no lugar de um parágrafo fixo */}
          <details className="pergunta mt-4 text-center text-[13px]">
            <summary className="alvo cursor-pointer text-muted hover:text-fg">Esqueci a senha</summary>
            <p className="mt-2 text-muted">Peça ao dono da empresa para redefinir. Se você é o dono, fale com a Solace.</p>
          </details>
          {process.env.SEED_DEMO === "true" && (
            <details className="pergunta mt-10 rounded-xl border border-line bg-surface/60 text-[13px] text-muted">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 font-medium text-fg">
                Acessos de demonstração
                <span aria-hidden="true" className="pergunta-sinal" />
              </summary>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 pb-4">
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
            </details>
          )}
        </div>
      </div>
      <footer className="mt-16 flex items-center gap-4 text-xs text-muted">
        <span>Solace</span>
        <Link href="/termos" className="alvo hover:text-fg">Termos de uso</Link>
        <Link href="/privacidade" className="alvo hover:text-fg">Privacidade</Link>
      </footer>
    </main>
  );
}
