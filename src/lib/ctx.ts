export type Role = "dono" | "atendente" | "caixa" | "entregador";

// branchId: filial onde a ação acontece (a do usuário, ou a que o dono escolheu ver)
export type Ctx = { tenantId: string; userId: string; role: Role; branchId: string };

export class DomainError extends Error {}

export function assertRole(ctx: Ctx, ...roles: Role[]) {
  if (!roles.includes(ctx.role)) throw new DomainError("Sem permissão para esta ação.");
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
