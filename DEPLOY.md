# Deploy na Hostinger com Coolify

Passo a passo para colocar o sistema no ar numa VPS própria. Leva cerca de 1 hora na primeira vez.

## O que precisa ter antes

- VPS **Hostinger KVM 2** em São Paulo, com **Ubuntu 24.04** (2 vCPU, 8 GB).
- Um **domínio** (ex.: `meudominio.com.br` no Registro.br).
- O código num **repositório privado no GitHub**. O Coolify publica a partir dele.
- Uma conta na **Cloudflare** com **R2** ativado, para guardar os backups fora da VPS (grátis até 10 GB).

## 1. Servidor

No painel da Hostinger, cadastre sua chave SSH e entre na VPS:

```bash
ssh root@IP_DA_VPS
```

Atualize o sistema e libere só as portas necessárias. A 8000 é o painel do Coolify e será fechada no passo 3.

```bash
apt update && apt upgrade -y
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw allow 8000 && ufw --force enable
```

Instale o Coolify:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Abra `http://IP_DA_VPS:8000` e crie a conta de administrador do Coolify.

## 2. Domínio

No DNS do domínio, crie três registros **A** apontando para o IP da VPS:

| Nome | Para quê |
| --- | --- |
| `app` | sistema dos clientes |
| `demo` | demonstração com dados fictícios |
| `coolify` | painel do Coolify |

A propagação costuma levar de minutos a algumas horas.

## 3. Painel do Coolify com HTTPS

Em **Settings**, coloque `https://coolify.meudominio.com.br` como domínio da instância e salve. Depois de abrir pelo domínio novo, feche a porta 8000:

```bash
ufw delete allow 8000
```

## 4. Banco de dados

1. **New Resource → PostgreSQL** (versão 17 ou mais nova). Dê o nome `gestao-db`.
2. Copie a **URL interna** de conexão (`postgres://...@...:5432/postgres`). Ela só funciona dentro da VPS, o que é o desejado.
3. **Backup:** em **S3 Storages**, cadastre o R2 (endpoint, bucket, access key, secret). No banco, em **Backups**, agende um backup diário às 3h nesse storage e guarde pelo menos 14 cópias.
4. Rode o primeiro backup manualmente e confira se o arquivo apareceu no bucket.

Para a demonstração, crie um segundo banco, `gestao-demo-db`. Assim os dados fictícios nunca se misturam com os dos clientes.

## 5. Aplicação

1. **New Resource → Private Repository (GitHub App)** e autorize o repositório.
2. Build pack: **Dockerfile**. Porta: **3000**.
3. Domínio: `https://app.meudominio.com.br`. O Coolify emite o certificado HTTPS sozinho.
4. **Health check:** caminho `/api/health`.
5. Variáveis de ambiente:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL interna do `gestao-db` |
| `ADMIN_EMAIL` | seu e-mail da Solace |
| `ADMIN_PASSWORD` | senha forte, só para o primeiro acesso |
| `ALERT_TELEGRAM_BOT_TOKEN` e `ALERT_TELEGRAM_CHAT_ID` | opcionais, veja Monitoramento |

6. **Deploy.** No log deve aparecer `[admin] ... criado`, e `/api/health` deve responder `{"ok":true}`.

Para a demonstração, repita o passo com o domínio `https://demo.meudominio.com.br`, o banco `gestao-demo-db` e mais uma variável: `SEED_DEMO=true`.

Com **Auto Deploy** ligado, cada `git push` na branch principal publica de novo. As migrações do banco rodam sozinhas quando o app sobe.

## 6. Primeiro acesso

1. Entre em `https://app.meudominio.com.br` com o `ADMIN_EMAIL`.
2. Em **Senha**, troque a senha e ative a verificação em duas etapas.
3. Em **Empresas**, crie a empresa do cliente com o acesso do dono.
4. Faça a implantação com o dono (veja o checklist no plano SaaS).

A senha de `ADMIN_PASSWORD` só é usada para criar o admin na primeira vez. Depois de trocada, pode remover a variável.

## 7. Testar a restauração do backup

Faça isso uma vez antes de entrar qualquer dado real, e repita a cada poucos meses.

1. Baixe o backup mais recente do bucket R2.
2. No Coolify, crie um banco temporário e use **Import Backup** com esse arquivo.
3. Aponte uma cópia da aplicação para esse banco (ou consulte direto) e confira se empresas, pedidos e acertos estão lá.
4. Apague o banco temporário.

Backup que nunca foi restaurado não é garantia de nada.

## 8. Monitoramento

O sistema registra sozinho todo erro inesperado do servidor. Eles aparecem em `/admin/erros`, agrupados e com contador. Para receber o aviso no celular:

1. No Telegram, fale com **@BotFather**, mande `/newbot` e siga as instruções. Ele devolve o **token** do bot.
2. Mande qualquer mensagem para o bot novo. Depois abra `https://api.telegram.org/bot<TOKEN>/getUpdates` no navegador e copie o número em `"chat":{"id": ...}`. Esse é o **chat id**.
3. No Coolify, adicione na aplicação as variáveis `ALERT_TELEGRAM_BOT_TOKEN` e `ALERT_TELEGRAM_CHAT_ID` e faça o redeploy.
4. Em `/admin/erros`, clique em **Enviar alerta de teste**. A mensagem precisa chegar no Telegram.

O mesmo erro avisa no máximo uma vez por hora. Se você marcar como resolvido e ele voltar, avisa na hora.

Isso não cobre o servidor inteiro fora do ar, porque aí ele não consegue avisar. Para esse caso, cadastre um monitor externo gratuito (UptimeRobot, Better Stack ou similar) checando `https://app.meudominio.com.br/api/health` a cada 5 minutos, com aviso por e-mail ou Telegram.

## Antes de colocar o primeiro cliente

- [ ] HTTPS funcionando em `app` e `demo`
- [ ] Backup diário no R2 e restauração testada
- [ ] Senha do admin trocada e 2FA ativo
- [ ] Porta 8000 fechada
- [ ] Alerta de teste chegando no Telegram e monitor externo do `/api/health` ativo
- [ ] Contrato de licença e termos de uso assinados
- [ ] Uma a duas semanas de operação em paralelo com o controle atual

## Quando algo dá errado

| Sintoma | Onde olhar |
| --- | --- |
| Deploy fica "unhealthy" | Logs da aplicação. Quase sempre é a `DATABASE_URL` errada ou o banco parado. |
| `/api/health` responde 503 | O app subiu, mas não alcança o banco. Confira se o banco está rodando. |
| Cliente vê "acesso suspenso" | A empresa foi suspensa em `/admin`. |
| Atendente ou entregador esqueceu a senha | O dono define uma senha nova em **Equipe → Redefinir senha**. |
| Dono esqueceu a senha ou perdeu o celular do 2FA | Em `/admin`, **Redefinir acesso** na linha da empresa: senha nova e 2FA desligado. Confirme a identidade do dono antes. |

## Custo mensal aproximado

| Item | Valor |
| --- | --- |
| VPS Hostinger KVM 2 | R$ 35 a 50 |
| Domínio .com.br | cerca de R$ 3,50 (R$ 40/ano) |
| Cloudflare R2 | grátis até 10 GB |

Preços aproximados, confira antes de contratar.
