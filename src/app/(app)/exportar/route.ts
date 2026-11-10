import { getUser, pendingTerms } from "@/lib/auth";
import { zipResponse } from "@/lib/zip-response";
import { exportTenant } from "@/domain/export";

// só o dono baixa a empresa inteira
export async function GET() {
  const user = await getUser();
  if (!user || user.role !== "dono" || pendingTerms(user)) return new Response("Não autorizado", { status: 401 });
  const { zip } = await exportTenant(user);
  return zipResponse(zip, user.tenantName);
}
