# Depósito

Sistema de gestão para distribuidoras de água e gás: pedidos, entregas, estoque de botijões e galões
(cheios e vazios) e acerto de caixa de cada entregador no fim do turno.

Suporta várias empresas no mesmo banco (`tenant_id` em todas as tabelas de negócio).

## Rodando local

Precisa de Node 24. Não precisa de Docker, o `npm run dev` sobe um Postgres local
(via `embedded-postgres`, dados em `~/.gestao-emp/pg`) junto com o Next.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Com `SEED_DEMO=true` o primeiro start cria uma empresa de exemplo. Logins: `dono@demo.com`,
`atendente@demo.com`, `joao@demo.com` e `carlos@demo.com`, senha `demo1234`.

Pra zerar o banco local é só apagar `~/.gestao-emp/pg`.

Outros comandos:

```bash
npm test              # testes das regras de caixa
npm run db:generate   # nova migração depois de mexer em src/db/schema.ts
```

As migrações em `drizzle/` rodam sozinhas quando o servidor sobe (`src/instrumentation.ts`).

## Deploy (Coolify)

1. Criar um PostgreSQL no Coolify.
2. Criar a aplicação apontando pro repositório, build pelo `Dockerfile`.
3. Definir `DATABASE_URL`. `SEED_DEMO` só em ambiente de demonstração.
4. Configurar domínio com HTTPS (o PWA do entregador precisa) e backup agendado do Postgres.

## Organização

- `src/domain`: regras de negócio (pedidos, turnos e acertos, estoque, cadastros) e consultas
- `src/app/actions.ts`: server actions, validam a entrada e o perfil antes de chamar o domínio
- `src/app/(app)`: telas do dono e do atendente
- `src/app/entregador`: tela do entregador, pensada pro celular
- `src/db`: schema do Drizzle, conexão e seed

Algumas decisões:

- valores sempre em centavos (inteiro);
- preço vem sempre do banco, nunca do formulário;
- saldo de estoque e caixa é calculado a partir das movimentações, não fica num campo editável;
- turno fechado não é alterado, e diferença no acerto exige observação.

## Pendências

- 2FA para o dono e limite de tentativas no login
- Pix via API (Asaas)
- estorno de pedido entregue e baixa de fiado
- contas a pagar e receber
- portal de pedidos para o cliente
- PWA offline
