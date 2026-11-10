import "server-only";
import { headers } from "next/headers";

/**
 * IP de quem fez a requisição. O proxy da frente (Traefik, no Coolify) acrescenta o IP real no FIM do
 * x-forwarded-for; o começo pode ter sido escrito pelo próprio cliente, então não serve para limite de tentativas.
 */
export async function clientIp() {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",").pop()?.trim() || "local";
}
