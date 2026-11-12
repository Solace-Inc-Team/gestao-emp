import Link from "next/link";
import { getUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default async function NotFound() {
  // quem está logado volta ao painel; visitante vai para a página inicial ("/" decide qual é)
  const user = await getUser();
  return (
    <main className="stagger mx-auto max-w-md px-6 py-24">
      <Link href="/" aria-label="Depósito, início">
        <Logo size={26} />
      </Link>
      <h1 className="h1 mt-10">Página não encontrada</h1>
      <p className="mt-2 text-muted">
        {user ? "O endereço não existe ou o registro é de outra empresa." : "O endereço não existe ou mudou de lugar."}
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        {user ? "Voltar ao painel" : "Ir para o início"}
      </Link>
    </main>
  );
}
