import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { Logo } from "@/components/logo";
import { NavLinks, type NavGroup } from "@/components/nav-links";
import { roleLabel } from "@/components/ui";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser("dono", "atendente");
  if (user.platformAdmin) redirect("/admin");

  const groups: NavGroup[] = [
    {
      links: [
        { href: "/pedidos/novo", label: "Novo pedido" },
        { href: "/", label: "Painel" },
      ],
    },
    {
      title: "Operação",
      links: [
        { href: "/pedidos", label: "Pedidos" },
        { href: "/caixa", label: "Caixa e acertos" },
        { href: "/estoque", label: "Estoque" },
        { href: "/clientes", label: "Clientes" },
        { href: "/fiado", label: "Fiado" },
      ],
    },
    {
      title: "Gestão",
      links: [
        { href: "/relatorios", label: "Relatórios" },
        { href: "/despesas", label: "Despesas" },
        ...(user.role === "dono"
          ? [
              { href: "/produtos", label: "Produtos e preços" },
              { href: "/equipe", label: "Equipe" },
            ]
          : []),
      ],
    },
  ];

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 lg:pt-5">
          <Logo />
          <form action={logout} className="lg:hidden">
            <button className="text-[13px] text-muted hover:text-fg">Sair</button>
          </form>
        </div>
        <p className="hidden truncate px-5 pb-5 text-[13px] text-muted lg:block">{user.tenantName}</p>
        <NavLinks groups={groups} />
        <div className="mt-auto hidden items-center gap-2.5 border-t border-line px-4 py-3 lg:flex">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-xs font-semibold">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="text-xs text-muted">{roleLabel[user.role]}</p>
          </div>
          <Link href="/senha" title="Trocar senha" aria-label="Trocar senha" className="grid size-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg">
            <KeyRound size={15} strokeWidth={1.75} />
          </Link>
          <form action={logout}>
            <button title="Sair" aria-label="Sair" className="grid size-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg">
              <LogOut size={15} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
