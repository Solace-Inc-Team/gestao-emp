export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { db, runMigrations } = await import("@/db");
  const { tenants } = await import("@/db/schema");
  await runMigrations();
  if (process.env.SEED_DEMO === "true") {
    const existing = await db.select({ id: tenants.id }).from(tenants).limit(1);
    if (!existing.length) {
      const { seedDemo } = await import("@/db/seed");
      await seedDemo();
      console.log("[seed] empresa demo criada (dono@demo.com / demo1234)");
    }
  }
}
