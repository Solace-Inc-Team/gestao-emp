import { getUser, pendingTerms } from "@/lib/auth";
import { listAddresses, listCustomers } from "@/domain/queries";

// busca do "Novo pedido": no servidor, para achar qualquer cliente e não só os primeiros da lista
export async function GET(req: Request) {
  const user = await getUser();
  if (!user || user.role === "entregador" || pendingTerms(user)) return new Response("Não autorizado", { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json([]);
  const found = (await listCustomers(user.tenantId, q)).slice(0, 8);
  const extra = await listAddresses(user.tenantId, found.map((c) => c.id));
  return Response.json(
    found.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      addresses: extra.filter((a) => a.customerId === c.id).map((a) => ({ id: a.id, label: a.label, address: a.address })),
    })),
  );
}
