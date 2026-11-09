export type Role = "dono" | "atendente" | "entregador";

export type Ctx = { tenantId: string; userId: string; role: Role };

export class DomainError extends Error {}

export function assertRole(ctx: Ctx, ...roles: Role[]) {
  if (!roles.includes(ctx.role)) throw new DomainError("Sem permissão para esta ação.");
}
