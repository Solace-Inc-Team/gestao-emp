import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="h1">Página não encontrada</h1>
      <p className="mt-2 text-muted">O endereço não existe ou o registro é de outra empresa.</p>
      <Link href="/" className="btn btn-primary mt-6">Voltar ao painel</Link>
    </main>
  );
}
