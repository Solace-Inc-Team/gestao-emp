import { test, expect, type Page } from "@playwright/test";

// Roda sobre a empresa de demonstração recém-criada (scripts/e2e-server.mjs).
const SENHA = "demo1234";

async function entrar(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/login/);
}

const mais = (page: Page, produto: string) => page.getByRole("group", { name: `Quantidade de ${produto}` }).getByRole("button", { name: "Aumentar" });

test("pedido em dinheiro: atendente lança, entregador entrega, caixa faz o acerto", async ({ page }) => {
  await entrar(page, "atendente@demo.com");
  await page.goto("/pedidos/novo");
  await page.getByLabel(/Buscar por nome/).fill("Ana");
  await page.getByRole("button", { name: /Ana Ribeiro/ }).click();
  await mais(page, "Gás P13").click();
  await page.getByLabel("Entregador").selectOption({ label: "Carlos Mendes" });
  await page.getByRole("button", { name: "Lançar pedido" }).click();
  await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}/);
  await expect(page.getByText("Em rota").first()).toBeVisible();

  // o atendente não fecha acerto: só o caixa e o dono
  await page.goto("/caixa");
  await expect(page.getByRole("link", { name: "Ver turno" }).first()).toBeVisible();

  await entrar(page, "carlos@demo.com");
  await expect(page).toHaveURL(/entregador/);
  await expect(page.getByRole("heading", { name: "2 entregas para fazer" })).toBeVisible();
  for (const restam of ["1 entrega para fazer", "Nenhuma entrega pendente"]) {
    await page.getByRole("button", { name: /^Entreguei/ }).first().click();
    await expect(page.getByRole("button", { name: "Desfazer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: restam })).toBeVisible({ timeout: 15_000 });
  }
  // troco de 30 + 110 da entrega em dinheiro; a outra era no cartão
  await expect(page.getByLabel("Seu caixa")).toContainText("R$ 140,00");

  await entrar(page, "caixa@demo.com");
  await page.goto("/caixa");
  await page.getByRole("listitem").filter({ hasText: "Carlos Mendes" }).getByRole("link", { name: "Repasse ou acerto" }).click();
  await expect(page.getByLabel("Conta do acerto")).toContainText("R$ 140,00");
  await page.getByLabel("Dinheiro contado").fill("140,00");
  await page.getByRole("button", { name: "Fechar acerto" }).click();
  // confirmação na janela do sistema: título é a pergunta, o texto traz a conta
  const janela = page.getByRole("dialog", { name: "Fechar o acerto?" });
  await expect(janela).toContainText("bateu");
  await janela.getByRole("button", { name: "Fechar acerto" }).click();
  await expect(page.getByText("Contado no acerto")).toBeVisible();
  await expect(page.getByLabel("Conta do acerto")).toContainText("sem diferença");
});

test("fiado: venda no balcão vira dívida e o pagamento quita", async ({ page }) => {
  await entrar(page, "dono@demo.com");
  await page.goto("/pedidos/novo");
  await page.getByRole("tab", { name: "Venda no balcão" }).click();
  await page.getByLabel(/Buscar por nome/).fill("Cláudia");
  await page.getByRole("button", { name: /Cláudia Martins/ }).click();
  await mais(page, "Galão de água 20L").click();
  await page.getByRole("button", { name: "Fiado", exact: true }).click();
  await page.getByRole("button", { name: "Registrar venda" }).click();
  await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}/);

  await page.getByRole("link", { name: "Cláudia Martins" }).click();
  await expect(page.getByText("Saldo devedor")).toBeVisible();
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(page.getByText("Tudo pago")).toBeVisible();
});

test("portal: cliente pede pelo link e o pedido chega à fila com o selo do site", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/pedir/fonte-azul");
  await mais(page, "Galão de água 20L").click();
  await page.getByLabel("Seu nome").fill("Cliente do Portal");
  await page.getByLabel("Telefone com DDD").fill("(11) 95555-0101");
  await page.getByLabel("Endereço").fill("Rua das Flores, 12 - Centro");
  await page.getByRole("button", { name: "Dinheiro na entrega" }).click();
  await page.getByRole("button", { name: "Fazer pedido" }).click();
  await expect(page.getByText(/Pedido #\d+ recebido/)).toBeVisible();

  await entrar(page, "atendente@demo.com");
  await page.goto("/entregas");
  const naFila = page.getByRole("listitem").filter({ hasText: "Cliente do Portal" });
  await expect(naFila).toContainText("Site");
  await expect(naFila).toContainText("Rua das Flores, 12");
});

test("cada perfil só entra no que é seu", async ({ page }) => {
  await entrar(page, "joao@demo.com");
  await page.goto("/caixa");
  await expect(page).toHaveURL(/entregador/);
  await page.goto("/configuracoes");
  await expect(page).toHaveURL(/entregador/);

  await entrar(page, "atendente@demo.com");
  await page.goto("/configuracoes");
  await expect(page).not.toHaveURL(/configuracoes/);
  // auditoria é só do dono
  await page.goto("/auditoria");
  await expect(page).not.toHaveURL(/auditoria/);
  expect((await page.goto("/admin"))?.status()).toBe(404);
  expect((await page.request.get("/exportar")).status()).toBe(401);
});

test("na raiz, visitante vê a apresentação e quem está logado cai no painel", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Todo casco volta");

  await entrar(page, "dono@demo.com");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Painel do dia" })).toBeVisible();
});
