import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

// Configurações viraram uma janela sobre o sistema: o endereço antigo abre a janela no painel.
export default async function Configuracoes() {
  await requireUser("dono");
  redirect("/?config=regras");
}
