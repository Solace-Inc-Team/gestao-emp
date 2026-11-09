import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

function connect() {
  const url = process.env.DATABASE_URL;
  // no `next build` não há banco; o cliente postgres só conecta na primeira consulta
  if (!url && process.env.NEXT_PHASE !== "phase-production-build")
    throw new Error("DATABASE_URL não definido. Em desenvolvimento, use `npm run dev` (sobe o Postgres local).");
  const client = postgres(url ?? "", { max: 10, onnotice: () => {} });
  return { client, db: drizzle(client, { schema }) };
}

const g = globalThis as unknown as { __conn?: ReturnType<typeof connect> };
const conn = (g.__conn ??= connect());

export const db = conn.db;
/** cliente postgres direto, para quando o drizzle atrapalha (ex.: linhas como listas na exportação) */
export const pgClient = conn.client;

export const runMigrations = () => migrate(db, { migrationsFolder: "drizzle" });
