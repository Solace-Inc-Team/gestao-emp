import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { portalProducts, portalTenant } from "@/domain/portal";
import { portalOrderAction } from "@/app/actions";
import { PortalForm } from "./portal-form";

export async function generateMetadata({ params }: PageProps<"/pedir/[slug]">): Promise<Metadata> {
  const t = await portalTenant((await params).slug);
  return { title: t ? `Pedido em ${t.name}` : "Pedidos", robots: { index: false } };
}

export default async function Pedir({ params, searchParams }: PageProps<"/pedir/[slug]">) {
  const { slug } = await params;
  // cada filial tem seu link: /pedir/<empresa>?filial=<slug da filial>
  const filial = (await searchParams).filial;
  const t = await portalTenant(slug, typeof filial === "string" ? filial : "");
  if (!t) notFound();
  const products = await portalProducts(t.id);

  return (
    <main className="stagger mx-auto min-h-screen max-w-lg px-4 py-8">
      <p className="text-[13px] text-muted">Pedido pelo site</p>
      <h1 className="h1">{t.name}</h1>
      {t.branchName && <p className="mt-0.5 font-medium">{t.branchName}</p>}
      <p className="mt-1 mb-6 text-muted">Escolha os produtos e informe onde entregar. A loja confirma pelo telefone se precisar.</p>
      {products.length ? (
        <PortalForm action={portalOrderAction.bind(null, slug, typeof filial === "string" ? filial : "")} products={products} pixEnabled={!!t.pixKey} />
      ) : (
        <p className="panel p-4 text-muted">Nenhum produto disponível agora. Ligue para a loja.</p>
      )}
      <p className="mt-8 text-[13px] text-muted">
        Usamos seu nome, telefone e endereço só para entregar o pedido e falar com você sobre ele. Veja a{" "}
        <Link href="/privacidade" className="underline">política de privacidade</Link>.
      </p>
    </main>
  );
}
