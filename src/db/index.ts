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
  return drizzle(postgres(url ?? "", { max: 10, onnotice: () => {} }), { schema });
}

const g = globalThis as unknown as { __db?: DB };
export const db = (g.__db ??= connect());

export const runMigrations = () => migrate(db, { migrationsFolder: "drizzle" });
