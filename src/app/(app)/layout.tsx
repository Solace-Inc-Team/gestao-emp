import Link from "next/link";
import { redirect } from "next/navigation";
import { TemaBotao } from "@/components/tema-botao";
import { KeyRound, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { MarcaDaSessao } from "@/components/logo";
import { NavLinks, type NavGroup } from "@/components/nav-links";
import { roleLabel } from "@/components/ui";
import { PageTransition } from "@/components/page-transition";
import { SeletorFilial } from "@/components/seletor-filial";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser("dono", "atendente", "caixa");
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
        { href: "/entregas", label: "Entregas" },
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
              { href: "/configuracoes", label: "Configurações" },
              { href: "/auditoria", label: "Auditoria" },
            ]
          : []),
      ],
    },
    { links: [{ href: "/ajuda", label: "Ajuda" }] },
  ];

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 lg:pt-5">
          <MarcaDaSessao />
          {/* o tema fica no alto nas duas larguras; Sair aqui só no celular (no computador está no rodapé) */}
          <div className="flex items-center gap-1">
            {/* no celular e no tablet não há rodapé lateral: quem está logado aparece aqui, e o toque leva a trocar a senha */}
            <Link
              href="/senha"
              aria-label={`${user.name}, ${roleLabel[user.role]}. Trocar senha`}
              className="mr-1 flex min-h-11 items-center gap-2 rounded-md px-1.5 hover:bg-subtle lg:hidden"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-subtle text-[11px] font-semibold">{initials(user.name)}</span>
              <span className="hidden leading-tight min-[360px]:block">
                <span className="block max-w-[7rem] truncate text-[13px] font-medium">{user.name.split(" ")[0]}</span>
                <span className="block text-[11.5px] text-muted">{roleLabel[user.role]}</span>
              </span>
            </Link>
            <TemaBotao className="size-11 lg:size-8" />
            <form action={logout} className="lg:hidden">
              <button className="tap px-2 text-[13px] text-muted hover:text-fg">Sair</button>
            </form>
          </div>
        </div>
        <p className="hidden truncate px-5 pb-5 text-[13px] text-muted lg:block">
          {user.tenantName}
          {/* a equipe vê a filial em que trabalha; o dono escolhe qual ver logo abaixo */}
          {user.branches.length > 1 && user.role !== "dono" && <span className="block truncate text-fg">{user.branchName}</span>}
        </p>
        {user.branches.length > 1 && user.role === "dono" && (
          <div className="px-5 pb-4 lg:-mt-3 lg:pb-5">
            <SeletorFilial atual={user.branchId} filiais={user.branches} />
          </div>
        )}
        <NavLinks groups={groups} />
        <div className="mt-auto hidden items-center gap-2.5 border-t border-line px-4 py-3 lg:flex">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-xs font-semibold">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="line-clamp-2 text-[13px] font-medium break-words">{user.name}</p>
            <p className="text-xs text-muted">{roleLabel[user.role]}</p>
          </div>
          <Link href="/senha" title="Trocar senha" aria-label="Trocar senha" className="grid size-11 place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg lg:size-8">
            <KeyRound size={15} strokeWidth={1.75} />
          </Link>
          <form action={logout}>
            <button title="Sair" aria-label="Sair" className="grid size-11 place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg lg:size-8">
              <LogOut size={15} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-10 lg:py-10">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
