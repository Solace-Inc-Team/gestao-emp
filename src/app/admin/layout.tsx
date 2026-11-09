import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { count, isNull } from "drizzle-orm";
import { db } from "@/db";
import { errorEvents } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/actions";
import { Logo } from "@/components/logo";
import { AdminNav } from "./admin-nav";

export const metadata = { title: { default: "Painel da Solace", template: "%s | Depósito" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const [{ n: openErrors }] = await db.select({ n: count() }).from(errorEvents).where(isNull(errorEvents.resolvedAt));
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 lg:px-10">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-line">/</span>
            <span className="text-[13px] font-medium">Solace</span>
            <span className="ml-3 hidden sm:block">
              <AdminNav openErrors={openErrors} />
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 hidden text-[13px] text-muted sm:inline">{admin.email}</span>
            <Link href="/senha" aria-label="Trocar senha" title="Trocar senha" className="grid size-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg">
              <KeyRound size={15} strokeWidth={1.75} />
            </Link>
            <form action={logout}>
              <button aria-label="Sair" title="Sair" className="grid size-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-fg">
                <LogOut size={15} strokeWidth={1.75} />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-10 lg:py-10">{children}</main>
    </>
  );
}
