import type { Instrumentation } from "next";

// todo erro não tratado no servidor (página, rota, server action) passa por aqui
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("@/domain/monitoring");
  await recordError(err, { path: request.path, method: request.method, kind: context.routeType });
};

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { db, runMigrations } = await import("@/db");
  const { tenants } = await import("@/db/schema");
  await runMigrations();

  // a demo vem antes do admin: ela só é criada com o banco vazio
  if (process.env.SEED_DEMO === "true") {
    const existing = await db.select({ id: tenants.id }).from(tenants).limit(1);
    if (!existing.length) {
      const { seedDemo } = await import("@/db/seed");
      await seedDemo();
      console.log("[seed] empresa demo criada (dono@demo.com / demo1234)");
    }
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const { ensurePlatformAdmin } = await import("@/domain/platform");
    if (await ensurePlatformAdmin(ADMIN_EMAIL, ADMIN_PASSWORD)) console.log(`[admin] ${ADMIN_EMAIL} criado`);
  }
}
