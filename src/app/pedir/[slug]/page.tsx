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

export default async function Pedir({ params }: PageProps<"/pedir/[slug]">) {
  const { slug } = await params;
  const t = await portalTenant(slug);
  if (!t) notFound();
  const products = await portalProducts(t.id);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <p className="text-[13px] text-muted">Pedido pelo site</p>
      <h1 className="h1">{t.name}</h1>
      <p className="mt-1 mb-6 text-muted">Escolha os produtos e informe onde entregar. A loja confirma pelo telefone se precisar.</p>
      {products.length ? (
        <PortalForm action={portalOrderAction.bind(null, slug)} products={products} pixEnabled={!!t.pixKey} />
      ) : (
        <p className="panel p-4 text-muted">Nenhum produto disponível agora. Ligue para a loja.</p>
      )}
      <p className="mt-8 text-[12px] text-muted">
        Usamos seu nome, telefone e endereço só para entregar o pedido e falar com você sobre ele. Veja a{" "}
        <Link href="/privacidade" className="underline">política de privacidade</Link>.
      </p>
    </main>
  );
}
