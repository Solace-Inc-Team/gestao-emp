import { z } from "zod";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, scoped, tenantTransaction, type Tx } from "@/db";
import { branches, orders, shifts, users } from "@/db/schema";
import { type Ctx, DomainError, assertRole } from "@/lib/ctx";
import { audit } from "./stock";

// Filiais: cada uma com estoque, equipe, turnos e despesas próprios. Só o dono cria, desativa e
// muda gente de filial. A principal nasce com a empresa e não sai.

/** Filiais da empresa, com quantas pessoas da equipe (ativas) cada uma tem. */
export const listFiliais = scoped(function listFiliais(tenantId: string) {
  return db
    .select({
      id: branches.id,
      name: branches.name,
      slug: branches.slug,
      main: branches.main,
      active: branches.active,
      // nomes escritos à mão: dentro da subconsulta o drizzle não diz de qual tabela é o "id"
      equipe: sql<number>`(select count(*) from users u where u.branch_id = "branches"."id" and u.active)::int`,
    })
    .from(branches)
    .where(eq(branches.tenantId, tenantId))
    .orderBy(desc(branches.main), desc(branches.active), asc(branches.name));
});

export const filialSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à filial (ex.: Centro).").max(60, "O nome pode ter até 60 letras."),
});

// "Vila Nova" -> "vila-nova": vai no link de pedido da filial
const slugDe = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "filial";

const repetido = (e: unknown) => ((e as { cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code) === "23505";

export async function criarFilial(ctx: Ctx, raw: z.input<typeof filialSchema>) {
  assertRole(ctx, "dono");
  const { name } = filialSchema.parse(raw);
  try {
    return await tenantTransaction(ctx, async (tx) => {
      // dois nomes diferentes podem dar o mesmo link ("Centro" e "centro!"): numera o segundo
      const base = slugDe(name);
      const usados = await tx.select({ slug: branches.slug }).from(branches).where(eq(branches.tenantId, ctx.tenantId));
      let slug = base;
      for (let n = 2; usados.some((u) => u.slug === slug); n++) slug = `${base}-${n}`;
      const [b] = await tx.insert(branches).values({ tenantId: ctx.tenantId, name, slug }).returning();
      await audit(tx, ctx, "empresa.filial_criar", "branch", b.id, { name });
      return b;
    });
  } catch (e) {
    if (repetido(e)) throw new DomainError("Já existe uma filial com este nome.");
    throw e;
  }
}

async function filialDaEmpresa(tx: Tx, ctx: Ctx, id: string) {
  const [b] = await tx
    .select()
    .from(branches)
    .where(and(eq(branches.id, id), eq(branches.tenantId, ctx.tenantId)))
    .for("update");
  if (!b) throw new DomainError("Filial não encontrada.");
  return b;
}

/**
 * Desativar tira a filial do menu e do link de pedidos, mas guarda o histórico. Só sem nada em andamento:
 * pedido aberto ou em rota, turno aberto ou gente da equipe ainda nela.
 */
export async function ativarFilial(ctx: Ctx, id: string, active: boolean) {
  assertRole(ctx, "dono");
  await tenantTransaction(ctx, async (tx) => {
    const b = await filialDaEmpresa(tx, ctx, id);
    if (!active) {
      if (b.main) throw new DomainError("A filial principal não pode ser desativada.");
      const [r] = await tx
        .select({
          pedidos: sql<number>`(select count(*) from ${orders} where ${orders.branchId} = ${b.id} and ${orders.status} in ('aberto', 'em_rota'))::int`,
          turnos: sql<number>`(select count(*) from ${shifts} where ${shifts.branchId} = ${b.id} and ${shifts.status} = 'aberto')::int`,
          equipe: sql<number>`(select count(*) from ${users} where ${users.branchId} = ${b.id} and ${users.active})::int`,
        })
        .from(sql`(select 1) as um`);
      if (r.pedidos) throw new DomainError(`${b.name} tem pedidos em aberto ou em rota. Conclua ou cancele antes.`);
      if (r.turnos) throw new DomainError(`${b.name} tem turno aberto. Faça o acerto antes.`);
      if (r.equipe) throw new DomainError(`${b.name} ainda tem gente da equipe. Passe todos para outra filial antes.`);
    }
    await tx.update(branches).set({ active }).where(eq(branches.id, b.id));
    await audit(tx, ctx, active ? "empresa.filial_reativar" : "empresa.filial_desativar", "branch", b.id, { name: b.name });
  });
}

/** Passa alguém da equipe para outra filial. Entregador com turno aberto só depois do acerto. */
export async function mudarDeFilial(ctx: Ctx, userId: string, branchId: string) {
  assertRole(ctx, "dono");
  await tenantTransaction(ctx, async (tx) => {
    const b = await filialDaEmpresa(tx, ctx, branchId);
    if (!b.active) throw new DomainError("Esta filial está desativada.");
    const [u] = await tx
      .select({ id: users.id, role: users.role, branchId: users.branchId, name: users.name })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, ctx.tenantId), ne(users.role, "dono")))
      .for("update");
    if (!u) throw new DomainError("Pessoa não encontrada.");
    if (u.branchId === b.id) return;
    const [aberto] = await tx
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.driverId, u.id), inArray(shifts.status, ["aberto"])));
    if (aberto) throw new DomainError(`${u.name} está com turno aberto. Faça o acerto antes de mudar de filial.`);
    await tx.update(users).set({ branchId: b.id }).where(eq(users.id, u.id));
    await audit(tx, ctx, "usuario.mudar_filial", "user", u.id, { from: u.branchId, to: b.id, filial: b.name });
  });
}

/** Filial ativa da empresa, para quem vai trabalhar nela (cadastro de pessoa). */
export async function filialAtiva(tx: Tx, ctx: Ctx, id: string) {
  const b = await filialDaEmpresa(tx, ctx, id);
  if (!b.active) throw new DomainError("Esta filial está desativada.");
  return b;
}
