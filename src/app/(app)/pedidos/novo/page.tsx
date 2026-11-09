import { requireUser } from "@/lib/auth";
import { listCustomers, listDrivers, listProducts, listShifts, stockOverview } from "@/domain/queries";
import { NewOrderForm } from "./new-order-form";

export const metadata = { title: "Novo pedido" };

export default async function NovoPedido({ searchParams }: PageProps<"/pedidos/novo">) {
  const user = await requireUser("dono", "atendente");
  const { cliente } = await searchParams;
  const [products, customers, drivers, open, stock] = await Promise.all([
    listProducts(user.tenantId, true),
    listCustomers(user.tenantId),
    listDrivers(user.tenantId),
    listShifts(user.tenantId, "aberto"),
    stockOverview(user.tenantId),
  ]);
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
        customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, address: c.address }))}
        drivers={drivers.map((d) => ({ ...d, onShift: onShift.has(d.id) }))}
        initialCustomerId={typeof cliente === "string" ? cliente : undefined}
      />
    </>
  );
}
