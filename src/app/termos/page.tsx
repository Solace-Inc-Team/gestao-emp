import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { BACKUP_RETENTION_DAYS, DELETE_AFTER_DAYS, EXPORT_WINDOW_DAYS, company } from "@/lib/legal";

export const metadata = { title: "Termos de uso" };

export default function Termos() {
  const { product, name, legalName, cnpj, city } = company;
  return (
    <LegalPage title="Termos de uso">
      <p>
        Estes termos regem o uso do {product}, sistema de gestão para distribuidoras de água e gás oferecido por {legalName} ({name}),
        CNPJ {cnpj}. Ao aceitar estes termos no primeiro acesso, a empresa contratante (chamada aqui de <strong>cliente</strong>)
        concorda com as regras abaixo. Se houver contrato assinado, ele prevalece no que for diferente.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O {product} é acessado pela internet e serve para registrar pedidos, entregas, estoque de vasilhames, acerto de caixa
        dos entregadores, fiado, despesas e relatórios. O cliente usa o sistema por assinatura; o software não é vendido nem
        instalado na empresa do cliente.
      </p>

      <h2>2. Contas e acesso</h2>
      <ul>
        <li>O dono da empresa recebe o primeiro acesso e cria os acessos de atendentes e entregadores.</li>
        <li>Cada pessoa usa o próprio login. Senhas são pessoais e não devem ser compartilhadas.</li>
        <li>O cliente responde pelo que sua equipe faz no sistema e deve desativar o acesso de quem sair da empresa.</li>
        <li>Recomendamos ativar a verificação em duas etapas na conta do dono.</li>
      </ul>

      <h2>3. Uso permitido</h2>
      <p>Não é permitido:</p>
      <ul>
        <li>usar o sistema para atividade ilegal ou para guardar dados obtidos de forma ilegal;</li>
        <li>tentar acessar dados de outras empresas, burlar o login ou testar a segurança sem autorização escrita;</li>
        <li>copiar, revender ou repassar o acesso a terceiros fora da sua empresa;</li>
        <li>sobrecarregar o sistema de propósito, por exemplo com acessos automáticos em massa.</li>
      </ul>
      <p>Uso que coloque em risco o serviço ou outros clientes pode levar à suspensão imediata do acesso.</p>

      <h2>4. Os dados do cliente</h2>
      <p>
        Os dados que o cliente cadastra (clientes dele, pedidos, estoque, caixa, equipe) pertencem ao cliente. A {name} trata esses
        dados apenas para prestar o serviço, como operadora, conforme a{" "}
        <Link href="/privacidade" className="underline">Política de Privacidade</Link>. O cliente garante que tem base legal para
        cadastrar os dados dos seus próprios clientes, como nome, telefone e endereço de entrega.
      </p>
      <p>
        O dono pode baixar a qualquer momento todos os dados da empresa em planilhas, pela opção Exportar todos os dados em
        Relatórios.
      </p>

      <h2>5. Pagamento e suspensão</h2>
      <p>
        Valores de implantação e mensalidade são os da proposta ou do contrato aceito pelo cliente. Em caso de atraso, a {name}{" "}
        avisa o cliente e pode suspender o acesso após o prazo informado no aviso. Durante a suspensão os dados são mantidos e o
        acesso volta após a regularização.
      </p>

      <h2>6. Disponibilidade, backups e suporte</h2>
      <ul>
        <li>A {name} trabalha para manter o sistema disponível, mas não garante funcionamento sem interrupções, salvo se o contrato prever um nível de serviço.</li>
        <li>Manutenções programadas serão avisadas com antecedência sempre que possível.</li>
        <li>É feito backup diário do banco de dados, guardado fora do servidor principal por {BACKUP_RETENTION_DAYS} dias.</li>
        <li>O suporte é prestado pelos canais e horários informados na proposta ou no contrato.</li>
      </ul>

      <h2>7. Propriedade do software</h2>
      <p>
        O {product}, seu código, marca e telas pertencem à {name}. O cliente recebe uma licença de uso não exclusiva e
        intransferível enquanto durar a assinatura. Sugestões de melhoria enviadas pelo cliente podem ser incorporadas ao produto
        e oferecidas a outros clientes, sem que isso gere direitos sobre o software.
      </p>

      <h2>8. Limites de responsabilidade</h2>
      <p>
        O sistema ajuda a controlar a operação, mas não substitui a conferência física do dinheiro e do estoque, que continua sendo
        do cliente. A {name} não responde por prejuízos causados por informação lançada errada, por uso indevido de senha ou por
        falhas de internet e equipamentos do cliente. Quando houver responsabilidade da {name}, ela fica limitada ao valor pago pelo
        cliente nos 12 meses anteriores ao fato.
      </p>

      <h2>9. Cancelamento e saída</h2>
      <ul>
        <li>O cliente pode cancelar a qualquer momento, conforme as condições de aviso prévio da proposta ou do contrato.</li>
        <li>Após o cancelamento, os dados ficam disponíveis para exportação por {EXPORT_WINDOW_DAYS} dias.</li>
        <li>Em até {DELETE_AFTER_DAYS} dias após o cancelamento os dados são excluídos. Cópias de backup expiram sozinhas em até {BACKUP_RETENTION_DAYS} dias depois disso.</li>
        <li>Dados que a lei obrigue a manter serão guardados apenas pelo prazo exigido.</li>
      </ul>

      <h2>10. Mudanças nestes termos</h2>
      <p>
        Quando estes termos mudarem de forma relevante, o dono da empresa verá a nova versão no próximo acesso e precisará aceitá-la
        para continuar usando o sistema.
      </p>

      <h2>11. Lei e foro</h2>
      <p>
        Estes termos seguem a lei brasileira, incluindo o Código Civil, o Marco Civil da Internet e a Lei Geral de Proteção de Dados.
        Fica eleito o foro de {city} para resolver qualquer questão sobre eles.
      </p>
    </LegalPage>
  );
}
