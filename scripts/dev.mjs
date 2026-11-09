// sobe um postgres local (embedded-postgres) e o next dev apontando pra ele
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const PORT = 5433;
// fora do projeto porque o initdb não lida bem com acento no caminho
const dataDir = process.env.PG_DATA_DIR ?? join(homedir(), ".gestao-emp", "pg");
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "app",
  password: "app",
  port: PORT,
  persistent: true,
});

const fresh = !existsSync(dataDir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) {
  // no Windows o cluster sobe em WIN1252, então o banco do app é criado em UTF8 na mão
  const client = pg.getPgClient();
  await client.connect();
  await client.query("CREATE DATABASE gestao ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'");
  await client.end();
}

const next = spawn(["npx next dev", ...process.argv.slice(2)].join(" "), {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: `postgres://app:app@localhost:${PORT}/gestao` },
});

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  next.kill();
  await pg.stop();
  process.exit(code);
}
next.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
