import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/actions";
import { Logo } from "@/components/logo";

export const metadata = { title: "Painel da Solace" };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  return (
    <>
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo light />
            <span className="rounded bg-white/10 px-2 py-0.5 text-sm">Solace</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-white/70 sm:inline">{admin.email}</span>
            <Link href="/senha" className="text-white/80 underline">Senha</Link>
            <form action={logout}>
              <button className="text-white/80 underline">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </>
  );
}
