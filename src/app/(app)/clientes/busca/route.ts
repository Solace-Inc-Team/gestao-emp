import { getUser } from "@/lib/auth";
import { listCustomers } from "@/domain/queries";

// busca do "Novo pedido": no servidor, para achar qualquer cliente e não só os primeiros da lista
export async function GET(req: Request) {
  const user = await getUser();
  if (!user || user.role === "entregador") return new Response("Não autorizado", { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json([]);
  const found = await listCustomers(user.tenantId, q);
  return Response.json(found.slice(0, 8).map((c) => ({ id: c.id, name: c.name, phone: c.phone, address: c.address })));
}
