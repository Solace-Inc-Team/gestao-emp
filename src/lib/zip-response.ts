import { todayISO } from "./period";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "empresa";

/** Download do ZIP de exportação, ex.: dados-distribuidora-fonte-azul-2026-11-09.zip */
export function zipResponse(zip: Uint8Array, companyName: string) {
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="dados-${slug(companyName)}-${todayISO()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
