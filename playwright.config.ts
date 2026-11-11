import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // os cenários contam uma história em cima do mesmo banco: um de cada vez, na ordem
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  // movimento reduzido: as animações não atrasam nem atrapalham os cliques
  use: { baseURL: "http://localhost:3100", locale: "pt-BR", timezoneId: "America/Sao_Paulo", contextOptions: { reducedMotion: "reduce" } },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: "http://localhost:3100/api/health",
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
