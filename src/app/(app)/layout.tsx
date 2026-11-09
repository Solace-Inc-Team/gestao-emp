import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { roleLabel } from "@/components/ui";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser("dono", "atendente");
  if (user.platformAdmin) redirect("/admin");
  const links = [
    { href: "/", label: "Painel" },
    { href: "/pedidos/novo", label: "Novo pedido" },
    { href: "/pedidos", label: "Pedidos" },
    { href: "/caixa", label: "Caixa e acertos" },
    { href: "/estoque", label: "Estoque" },
    { href: "/clientes", label: "Clientes" },
    { href: "/relatorios", label: "Relatórios" },
    ...(user.role === "dono"
      ? [
          { href: "/produtos", label: "Produtos e preços" },
          { href: "/equipe", label: "Equipe" },
        ]
      : []),
  ];
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-white lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-5 lg:py-6">
          <Logo />
          <p className="hidden text-sm text-ink-soft lg:mt-2 lg:block">{user.tenantName}</p>
          <form action={logout} className="lg:hidden">
            <button className="text-sm text-water">Sair</button>
          </form>
        </div>
        <NavLinks links={links} />
        <div className="hidden border-t border-line px-5 py-4 text-sm lg:block">
          <p className="font-semibold">{user.name}</p>
          <p className="text-ink-soft">{roleLabel[user.role]}</p>
          <div className="mt-2 flex gap-4">
            <Link href="/senha" className="text-water underline-offset-2 hover:underline">Trocar senha</Link>
            <form action={logout}>
              <button className="text-water underline-offset-2 hover:underline">Sair</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
