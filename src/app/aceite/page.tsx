import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, pendingTerms } from "@/lib/auth";
import { company, termsDate } from "@/lib/legal";
import { acceptTermsAction, logout } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Logo } from "@/components/logo";

export const metadata = { title: "Termos de uso" };

export default async function Aceite() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!pendingTerms(user)) redirect("/");
  const update = user.termsVersion !== null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Logo size={28} />
        <h1 className="mt-8 text-[1.75rem] leading-tight font-semibold tracking-[-0.03em]">
          {update ? "Os termos foram atualizados" : `Bem-vindo ao ${company.product}`}
        </h1>
        <p className="mt-2 text-muted">
          {update
            ? `Leia a versão de ${termsDate} para continuar usando o sistema.`
            : `Antes de começar, leia e aceite as regras de uso do sistema para ${user.tenantName}.`}
        </p>

        <ul className="mt-6 space-y-2 text-[13px] text-muted">
          <li>Os dados cadastrados são da sua empresa e você pode exportá-los quando quiser.</li>
          <li>A {company.name} trata os dados dos seus clientes só para prestar o serviço.</li>
          <li>Cada pessoa da equipe usa o próprio login; você responde pelos acessos que criar.</li>
        </ul>

        <div className="mt-6 flex gap-4 text-[13px]">
          <Link href="/termos" target="_blank" className="font-medium underline underline-offset-2">Termos de uso</Link>
          <Link href="/privacidade" target="_blank" className="font-medium underline underline-offset-2">Política de privacidade</Link>
        </div>

        <ActionForm action={acceptTermsAction} className="mt-6 space-y-4">
          <label className="flex items-start gap-2.5 text-[13px]">
            <input type="checkbox" name="agree" required className="mt-0.5" />
            Li e aceito os Termos de uso e a Política de privacidade em nome de {user.tenantName}.
          </label>
          <button className="btn btn-primary h-10 w-full">Aceitar e continuar</button>
        </ActionForm>
        <form action={logout} className="mt-4 text-center">
          <button className="text-[13px] text-muted hover:text-fg">Sair sem aceitar</button>
        </form>
      </div>
    </main>
  );
}
