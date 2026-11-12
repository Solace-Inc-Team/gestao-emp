import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

function connect() {
  const url = process.env.DATABASE_URL;
  // no `next build` não há banco; o cliente postgres só conecta na primeira consulta
  if (!url && process.env.NEXT_PHASE !== "phase-production-build")
    throw new Error("DATABASE_URL não definido. Em desenvolvimento, use `npm run dev` (sobe o Postgres local).");
  const client = postgres(url ?? "", { max: 20, onnotice: () => {} });
  return { client, db: drizzle(client, { schema }) };
}

const g = globalThis as unknown as { __conn?: ReturnType<typeof connect>; __scope?: AsyncLocalStorage<Scope> };
const conn = (g.__conn ??= connect());

type Scope = { tenantId: string; tx: Tx };
const scope = (g.__scope ??= new AsyncLocalStorage<Scope>());

/**
 * Dentro de withTenant, `db` aponta para a transação da empresa: as mesmas consultas de sempre
 * passam a rodar com o papel app_tenant, e o Postgres (RLS) só mostra linhas daquela empresa.
 * Fora dele, `db` é a conexão normal (login, admin, migrações, monitoramento).
 */
export const db: DB = new Proxy(conn.db, {
  get(base, prop) {
    const target = scope.getStore()?.tx ?? base;
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export async function withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  const current = scope.getStore();
  if (current) {
    if (current.tenantId !== tenantId) throw new Error("Operação de outra empresa dentro do escopo atual.");
    return fn();
  }
  return conn.db.transaction(async (tx) => {
    await tx.execute(sql`set local role app_tenant`);
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return scope.run({ tenantId, tx }, fn);
  });
}

/** Envolve uma função de leitura cujo primeiro argumento é o tenantId. */
export function scoped<A extends [string, ...unknown[]], R>(fn: (...args: A) => R) {
  return (...args: A) => withTenant(args[0], () => Promise.resolve(fn(...args)));
}

/** cliente postgres direto, para quando o drizzle atrapalha (ex.: linhas como listas na exportação) */
export const pgClient = conn.client;

export async function runMigrations() {
  await migrate(conn.db, { migrationsFolder: "drizzle" });
  await conn.db.execute(garantirIsolamento);
}

// O backup (pg_dump) guarda o banco, mas não os papéis do servidor. Restaurado num Postgres novo,
// o app_tenant não existe e as permissões e políticas dele ficam de fora, mesmo com as migrações
// já marcadas como feitas. Toda subida refaz o que faltar; as tabelas com RLS ligado dizem onde.
const garantirIsolamento = sql.raw(`
DO $$
DECLARE
  t text;
  col text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN;
  END IF;
  IF NOT pg_has_role(current_user, 'app_tenant', 'MEMBER') THEN
    EXECUTE format('GRANT app_tenant TO %I', current_user);
  END IF;
  GRANT USAGE ON SCHEMA public TO app_tenant;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polname = 'tenant_isolation')
  LOOP
    col := CASE WHEN t = 'tenants' THEN 'id' ELSE 'tenant_id' END;
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I TO app_tenant
         USING (%2$I = current_setting(''app.tenant_id'')::uuid)
         WITH CHECK (%2$I = current_setting(''app.tenant_id'')::uuid)', t, col);
  END LOOP;
END
$$`);

/** Transação de escrita de uma empresa, já dentro do escopo dela (RLS ativo). */
export const tenantTransaction = <T>(ctx: { tenantId: string }, fn: (tx: Tx) => Promise<T>) =>
  withTenant(ctx.tenantId, () => db.transaction(fn));
