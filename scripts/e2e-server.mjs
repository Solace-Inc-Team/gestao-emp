// servidor dos testes de ponta a ponta: banco próprio (gestao_e2e), recriado a cada rodada com a demo,
// e um next dev na porta 3100 em outra pasta de build, para não brigar com o `npm run dev` aberto
import postgres from "postgres";
import { spawn } from "node:child_process";

const ADMIN_URL = process.env.TEST_PG_URL ?? "postgres://app:app@localhost:5433/postgres";
const DB = "gestao_e2e";

const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
await admin.unsafe(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
await admin.unsafe(`CREATE DATABASE ${DB} ENCODING 'UTF8' TEMPLATE template0`);
await admin.end();

const next = spawn("npx next dev -p 3100", {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: ADMIN_URL.replace(/\/[^/]*$/, `/${DB}`),
    SEED_DEMO: "true",
    NEXT_DIST_DIR: ".next-e2e",
  },
});
next.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => next.kill());
