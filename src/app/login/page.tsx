import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { login } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Logo } from "@/components/logo";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(user.role === "entregador" ? "/entregador" : "/");
  return (
    <main className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-ink p-10 text-white md:flex">
        <Logo light />
        <div className="max-w-md">
          <p className="font-[family-name:var(--font-cond)] text-5xl font-semibold leading-[1.05]">
            Cada botijão, cada galão e cada real conferidos no fim do turno.
          </p>
          <p className="mt-5 text-lg text-white/70">
            Pedidos, entregas, cheios e vazios e o acerto de cada entregador num só lugar.
          </p>
        </div>
        <p className="text-sm text-white/50">Solace</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Logo />
          </div>
          <h1 className="h1 mb-6">Entrar</h1>
          <ActionForm action={login} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="username" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
            </div>
            <button className="btn btn-primary w-full">Entrar</button>
          </ActionForm>
          {process.env.SEED_DEMO === "true" && (
            <div className="mt-8 rounded-md border border-line bg-white p-4 text-sm text-ink-soft">
              <p className="mb-1 font-semibold text-ink">Demonstração</p>
              <ul className="space-y-0.5">
                <li>Dono: <b>dono@demo.com</b></li>
                <li>Atendente: <b>atendente@demo.com</b></li>
                <li>Entregador: <b>joao@demo.com</b></li>
              </ul>
              <p className="mt-1">Senha de todos: <b>demo1234</b></p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
