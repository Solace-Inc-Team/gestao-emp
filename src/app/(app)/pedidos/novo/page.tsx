import { requireUser } from "@/lib/auth";
import { getCustomer, listDrivers, listProducts, listShifts, stockOverview } from "@/domain/queries";
import { withTenant } from "@/db";
import { NewOrderForm } from "./new-order-form";

export const metadata = { title: "Novo pedido" };

export default async function NovoPedido({ searchParams }: PageProps<"/pedidos/novo">) {
  const user = await requireUser("dono", "atendente", "caixa");
  const { cliente } = await searchParams;
  // uma transação só para as leituras da tela: não ocupa 5 conexões do banco por visita
  const [products, initial, drivers, open, stock] = await withTenant(user.tenantId, () =>
    Promise.all([
      listProducts(user.tenantId, true),
      typeof cliente === "string" && /^[0-9a-f-]{36}$/.test(cliente) ? getCustomer(user.tenantId, cliente) : null,
      listDrivers(user.tenantId),
      listShifts(user.tenantId, "aberto"),
      stockOverview(user.tenantId),
    ]),
  );
  const onShift = new Set(open.map((s) => s.driverId));
  return (
    <>
      <h1 className="h1 mb-6">Novo pedido</h1>
      <NewOrderForm
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          priceCents: p.priceCents,
          returnable: p.returnable,
          available: stock.find((s) => s.id === p.id)?.fullStore ?? 0,
        }))}
        drivers={drivers.map((d) => ({ ...d, onShift: onShift.has(d.id) }))}
        initialCustomer={initial ? { id: initial.id, name: initial.name, phone: initial.phone, address: initial.address } : undefined}
      />
    </>
  );
}
