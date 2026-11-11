# Depósito

Gestão para distribuidoras de água e gás: pedidos, entregas, estoque de botijões e galões (cheios e
vazios) e o acerto de caixa de cada entregador. Começou para uma revenda e já atende várias empresas no
mesmo banco, cada uma enxergando só os próprios dados.

![Painel do dia](docs/telas/painel.png)

## Pra que serve

Numa revenda o pedido chega pelo WhatsApp, o entregador sai com o gás, recebe em dinheiro e acerta no fim
do dia. Quando o dinheiro não bate, ninguém sabe se faltou uma entrega, um troco ou um botijão. Aqui
cada venda, cada real e cada vasilhame ficam registrados com quem fez e quando.

## Telas

### Pedidos e entregas

O atendente lança o pedido buscando o cliente pelo nome ou telefone (dá pra fazer tudo pelo teclado, `/`
busca e Ctrl+Enter lança). O preço vem sempre do cadastro. Na tela de entregas aparece o que está
esperando, o que está com cada entregador e o que atrasou.

Se o cliente só quis parte do pedido, o entregador registra a entrega parcial e o total é refeito. Se
não achou ninguém, o pedido volta pra fila com o motivo. Também tem desconto com limite por perfil,
pagamento misto (parte em dinheiro, parte no Pix) e mais de um endereço por cliente.

| Novo pedido | Entregas |
|---|---|
| ![Novo pedido](docs/telas/novo-pedido.png) | ![Entregas](docs/telas/entregas.png) |

### Caixa

Cada entregador abre o turno com um troco. Durante o dia ele pode deixar parte do dinheiro no caixa ou
pagar um gasto autorizado (gasolina, por exemplo). No fim, o caixa ou o dono conta o dinheiro e fecha o
acerto; o próprio entregador não consegue. Se faltar ou sobrar, a diferença fica pendente até o dono
dizer o que foi feito dela. Pix só conta como recebido depois que alguém confere no extrato.

![Acerto de caixa](docs/telas/acerto.png)

### Estoque

Cheios, vazios e avariados, na loja e com cada entregador. Pedido que ainda não saiu já segura o
botijão na loja. O inventário é feito de uma vez e só as diferenças viram ajuste.

![Estoque no modo escuro](docs/telas/estoque.png)

### Celular

O entregador vê só as entregas dele, quanto deve ter em dinheiro e um botão grande pra confirmar, com
5 segundos pra desfazer. Sem internet a confirmação fica guardada e vai sozinha quando o sinal volta.
O cliente também pode pedir pelo link da loja e já recebe o QR do Pix.

| Entregador | Pedido pelo site |
|---|---|
| <img src="docs/telas/entregador.png" width="300" alt="Tela do entregador"> | <img src="docs/telas/portal.png" width="300" alt="Pedido pelo site"> |

Além disso: fiado com extrato, despesas, estorno de venda, relatórios por dia, entregador e produto,
fechamento do dia pra imprimir, exportação dos dados em planilha e um painel da Solace pra criar,
suspender e excluir empresas.

## Perfis

| Perfil | O que faz |
|---|---|
| Dono | Tudo: preços, equipe, estornos, inventário, configurações |
| Caixa | Pedidos e entregas, mais repasses, acertos e conferência de Pix |
| Atendente | Pedidos, clientes, entregas e entrada de estoque |
| Entregador | Só as próprias entregas, pelo celular |

## Por dentro

Next.js 16 com server actions, TypeScript, PostgreSQL com Drizzle e Tailwind. As regras ficam em
`src/domain`; as telas chamam as actions de `src/app/actions.ts`, que conferem perfil e entrada e
chamam o domínio.

Algumas escolhas:

- Isolamento entre empresas em duas camadas. Toda consulta filtra pela empresa e, por baixo, o Postgres
  aplica Row-Level Security: cada requisição roda numa transação com um papel sem privilégios e a empresa
  fixada (`withTenant` em [src/db/index.ts](src/db/index.ts)). Se alguém esquecer o filtro, continua
  isolado. Tem teste pra isso.
- Estoque e caixa não têm campo de saldo. O saldo é a soma dos lançamentos, que nunca são apagados; erro
  se corrige com estorno.
- Dinheiro sempre em centavos inteiros.
- Concorrência resolvida no banco com `SELECT ... FOR UPDATE`: dois pedidos ao mesmo tempo não pegam o
  mesmo número nem o último botijão, e um acerto não fecha no meio de um despacho.
- Estorno, ajuste de estoque, inventário e apagar dados de cliente pedem a senha de novo.
- Sessão, 2FA e o código Pix são feitos aqui mesmo com `node:crypto`, sem serviço externo.

```
src/
  domain/     regras: pedidos, turnos, estoque, fiado, despesas, portal, plataforma
  app/        telas e server actions
  db/         schema, conexão por empresa, dados de demonstração
  lib/        cálculo de caixa, Pix, 2FA, CSV, sessão, limite de tentativas
drizzle/      migrações, aplicadas quando o servidor sobe
e2e/          testes no navegador
```

## Rodando local

Só precisa de Node 24. O `npm run dev` sobe um Postgres junto (`embedded-postgres`, dados em
`~/.gestao-emp/pg`), sem Docker.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Com `SEED_DEMO=true` o primeiro start cria a empresa de exemplo "Distribuidora Fonte Azul". A senha de
todos é `demo1234`:

| Perfil | E-mail |
|---|---|
| Dono | dono@demo.com |
| Atendente | atendente@demo.com |
| Caixa | caixa@demo.com |
| Entregadores | joao@demo.com, carlos@demo.com |

O pedido pelo site fica em `/pedir/fonte-azul`. Com `ADMIN_EMAIL` e `ADMIN_PASSWORD` definidos, o start
cria também o acesso ao `/admin`. Pra zerar o banco, apague `~/.gestao-emp/pg`.

## Testes

```bash
npm test            # cálculo de caixa, Pix, 2FA, CSV
npm run test:db     # regras com Postgres de verdade
npm run test:e2e    # navegador: pedido até o acerto, fiado, pedido pelo site, acesso por perfil
```

Os dois últimos usam o Postgres do `npm run dev` e criam bancos próprios, sem mexer nos dados locais.
Na primeira vez rode `npx playwright install chromium`.

## Deploy

Um `Dockerfile` e um Postgres. O passo a passo pra VPS com Coolify, com backup e alertas, está no
[DEPLOY.md](DEPLOY.md).

## Falta

- baixa automática de Pix (hoje é conferido no extrato)
- cobrança da assinatura e filiais
- comodato e caução de vasilhame
- cliente acompanhar o pedido pelo site
- dados da empresa em `src/lib/legal.ts` e revisão dos termos por um advogado

Uso restrito à Solace.
