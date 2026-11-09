import { LegalPage } from "@/components/legal-page";
import { BACKUP_RETENTION_DAYS, DELETE_AFTER_DAYS, EXPORT_WINDOW_DAYS, company } from "@/lib/legal";

export const metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  const { product, name, legalName, privacyEmail } = company;
  return (
    <LegalPage title="Política de privacidade">
      <p>
        Esta política explica quais dados pessoais o {product} trata, para quê, com quem são compartilhados e como exercer seus
        direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>

      <h2>1. Quem é responsável</h2>
      <p>O {product} tem dois tipos de dado, com responsáveis diferentes:</p>
      <ul>
        <li>
          <strong>Dados que a distribuidora cadastra</strong> sobre os clientes dela (nome, telefone, endereço, pedidos, fiado). Aqui a
          distribuidora é a <strong>controladora</strong>: ela decide o que cadastrar e para quê. A {legalName} ({name}) é a{" "}
          <strong>operadora</strong> e trata esses dados apenas para prestar o serviço.
        </li>
        <li>
          <strong>Dados das contas de acesso</strong> (dono, atendentes, entregadores) e registros de segurança do sistema. Aqui a{" "}
          {name} é a <strong>controladora</strong>.
        </li>
      </ul>

      <h2>2. Quais dados</h2>
      <ul>
        <li>Contas de acesso: nome, e-mail, perfil, senha (guardada apenas como hash, nunca em texto) e configuração da verificação em duas etapas.</li>
        <li>Clientes da distribuidora: nome, telefone, endereço, ponto de referência, observações e histórico de pedidos, pagamentos e fiado.</li>
        <li>Operação: pedidos, entregas, estoque, acertos de caixa e despesas, com quem fez cada registro e quando.</li>
        <li>Registros técnicos: histórico de alterações, tentativas de login erradas (guardadas por 15 minutos) e erros do sistema, gravados sem o conteúdo de buscas.</li>
      </ul>
      <p>O {product} não coleta dados de localização, não usa câmera e não guarda número de cartão.</p>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Prestar o serviço contratado pela distribuidora.</li>
        <li>Manter a segurança: login, verificação em duas etapas, bloqueio de tentativas em massa e histórico de alterações.</li>
        <li>Dar suporte e corrigir erros.</li>
        <li>Cobrar a assinatura e cumprir obrigações legais e fiscais.</li>
      </ul>
      <p>Não vendemos dados, não usamos dados para publicidade e não fazemos perfil de comportamento dos clientes da distribuidora.</p>

      <h2>4. Bases legais</h2>
      <p>
        Para as contas de acesso, a base é a execução do contrato com a distribuidora e o legítimo interesse em manter o sistema
        seguro. Para obrigações fiscais, o cumprimento de obrigação legal. Para os dados dos clientes da distribuidora, a base legal é
        definida pela própria distribuidora, como controladora.
      </p>

      <h2>5. Com quem compartilhamos</h2>
      <p>Usamos fornecedores apenas para operar o serviço:</p>
      <ul>
        <li><strong>Hostinger</strong>: servidor onde o sistema e o banco de dados rodam, localizado no Brasil.</li>
        <li><strong>Cloudflare</strong>: guarda as cópias de backup do banco de dados, com criptografia em repouso.</li>
        <li><strong>Telegram</strong>: recebe avisos técnicos de erro para a equipe da {name}. Os avisos trazem a mensagem técnica e a tela onde o erro aconteceu, sem dados de clientes.</li>
      </ul>
      <p>Também podemos fornecer dados quando exigido por lei ou por ordem judicial.</p>

      <h2>6. Transferência para fora do Brasil</h2>
      <p>
        As cópias de backup podem ficar em servidores da Cloudflare fora do Brasil. Essa transferência é feita apenas para garantir
        a recuperação dos dados e segue as hipóteses do artigo 33 da LGPD, com fornecedor que adota padrões de segurança
        compatíveis.
      </p>

      <h2>7. Por quanto tempo guardamos</h2>
      <ul>
        <li>Enquanto a distribuidora for cliente, os dados ficam no sistema.</li>
        <li>Após o cancelamento, a distribuidora pode exportar tudo por {EXPORT_WINDOW_DAYS} dias. Em até {DELETE_AFTER_DAYS} dias os dados são excluídos.</li>
        <li>Backups expiram sozinhos em {BACKUP_RETENTION_DAYS} dias.</li>
        <li>Registros técnicos de erro são apagados após 12 meses.</li>
        <li>Dados que a lei obrigue a manter são guardados apenas pelo prazo exigido.</li>
      </ul>

      <h2>8. Segurança</h2>
      <ul>
        <li>Conexão sempre criptografada (HTTPS).</li>
        <li>Senhas guardadas com hash forte; verificação em duas etapas disponível.</li>
        <li>Cada empresa só acessa os próprios dados, com teste automático que verifica esse isolamento.</li>
        <li>Bloqueio temporário após várias senhas erradas.</li>
        <li>Backup diário fora do servidor principal e histórico de quem alterou o quê.</li>
      </ul>

      <h2>9. Seus direitos</h2>
      <p>
        A LGPD garante acesso, correção, anonimização ou eliminação, portabilidade, informação sobre compartilhamento e revisão de
        consentimento, entre outros.
      </p>
      <ul>
        <li>Se você é <strong>cliente de uma distribuidora</strong>, faça o pedido à própria distribuidora. A {name} ajuda a distribuidora a atender.</li>
        <li>Se você tem <strong>conta de acesso</strong> ao sistema, escreva para {privacyEmail}.</li>
      </ul>
      <p>Respondemos em até 15 dias.</p>

      <h2>10. Cookies</h2>
      <p>
        O {product} usa um único cookie, essencial, que mantém você logado. Não usamos cookies de publicidade nem de rastreamento.
      </p>

      <h2>11. Mudanças e contato</h2>
      <p>
        Quando esta política mudar de forma relevante, a nova versão é apresentada no sistema. Encarregado pelo tratamento de dados:{" "}
        {privacyEmail}.
      </p>
    </LegalPage>
  );
}
