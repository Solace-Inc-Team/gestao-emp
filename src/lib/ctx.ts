export type Role = "dono" | "atendente" | "entregador";

export type Ctx = { tenantId: string; userId: string; role: Role };

export class DomainError extends Error {}

export function assertRole(ctx: Ctx, ...roles: Role[]) {
  if (!roles.includes(ctx.role)) throw new DomainError("Sem permissão para esta ação.");
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
