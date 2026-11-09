import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { exportTenant } from "@/domain/export";
import { zipResponse } from "@/lib/zip-response";

// Solace exporta qualquer empresa (cliente que cancela, pedido do titular pela LGPD)
export async function GET(req: Request) {
  const admin = await getUser();
  if (!admin?.platformAdmin) return new Response("Não encontrado", { status: 404 });
  const id = new URL(req.url).searchParams.get("empresa") ?? "";
  const [t] = /^[0-9a-f-]{36}$/.test(id) ? await db.select().from(tenants).where(eq(tenants.id, id)) : [];
  if (!t) return new Response("Empresa não encontrada", { status: 404 });
  const { zip } = await exportTenant({ tenantId: t.id, userId: admin.userId });
  return zipResponse(zip, t.name);
}
