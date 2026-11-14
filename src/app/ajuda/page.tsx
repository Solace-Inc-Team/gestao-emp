import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { roleLabel } from "@/components/ui";
import type { Role } from "@/lib/ctx";

export const metadata = { title: "Ajuda" };

// Manual de operação: o que cada perfil faz no dia a dia e o que fazer quando algo sai do normal.
// Os nomes entre aspas são exatamente os dos botões e campos das telas.

type Secao = { id: string; titulo: string; perfis: Role[]; corpo: ReactNode };

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-fg">“{children}”</strong>;

const secoes: Secao[] = [
  {
    id: "atendente",
    titulo: "Atendente: pedidos e entregas",
    perfis: ["atendente", "caixa", "dono"],
    corpo: (
      <>
        <h3>Lançar um pedido</h3>
        <ol>
          <li>Em <B>Novo pedido</B>, digite nome, telefone ou endereço em <B>Buscar por nome, telefone ou endereço</B> (a tecla <kbd>/</kbd> leva direto para a busca). Cliente novo: cadastre ali mesmo.</li>
          <li>Use <B>+</B> e <B>−</B> em cada produto. Se o cliente não tem vasilhame vazio para trocar, marque <B>Cliente não tem vasilhame para trocar</B> e escolha: <B>Vender o vasilhame</B> (o casco entra no preço) ou <B>Emprestar (comodato)</B> (a loja empresta e não cobra; precisa do cliente identificado).</li>
          <li>Escolha o pagamento. Em dinheiro, preencha <B>Troco para</B> quando o cliente avisar a nota; o entregador já sai sabendo o troco.</li>
          <li>Desconto só até o limite que o dono definiu, sempre com motivo.</li>
          <li>Clique em <B>Lançar pedido</B> (ou <kbd>Ctrl</kbd> + <kbd>Enter</kbd>). O preço sempre vem do cadastro; não dá para mudar na hora.</li>
        </ol>
        <p>Venda no balcão: use a aba <B>Venda no balcão</B>. O pedido já nasce entregue.</p>
        <h3>Despachar</h3>
        <p>Em <B>Entregas</B>, os pedidos esperando ficam à esquerda, do mais antigo para o mais novo. Escolha o entregador e clique em <B>Saiu para entrega</B>. Só aparece quem está com turno aberto.</p>
        <h3>O cliente acompanha o pedido</h3>
        <p>No pedido, <B>Mandar no WhatsApp</B> ou <B>Copiar link</B> manda ao cliente uma página que mostra se o pedido foi recebido, saiu ou foi entregue, sem login. Quem pede pelo site já recebe esse link no fim do pedido.</p>
        <h3>Vasilhame emprestado (comodato)</h3>
        <p>Na tela do cliente, <B>Vasilhames em comodato</B> mostra quantos cascos da loja estão com ele e a caução que deixou. Quando ele devolver, use <B>Receber vasilhames de volta</B>: os cascos voltam como vazios e, se houver caução, você registra quanto devolveu.</p>
        <h3>Quando o pedido volta</h3>
        <p>Se o entregador não conseguiu entregar, o pedido volta para a fila com o motivo em amarelo. Dá para mandar de novo, trocar o entregador ou cancelar. Cancelar só antes de sair; depois de sair, quem decide é o caixa ou o dono.</p>
      </>
    ),
  },
  {
    id: "entregador",
    titulo: "Entregador: o celular",
    perfis: ["entregador", "caixa", "dono"],
    corpo: (
      <>
        <p>No celular, abra o endereço do sistema e entre com seu e-mail. Para virar um ícone na tela, use <B>Adicionar à tela inicial</B> no menu do navegador.</p>
        <ol>
          <li>Aparecem só as suas entregas, com endereço (toque para abrir o mapa), telefone, o que levar e quanto cobrar.</li>
          <li>Entregou e recebeu: toque em <B>Entreguei e recebi</B>. Você tem 5 segundos para <B>Desfazer</B> se tocou no pedido errado.</li>
          <li>Cliente quis só parte: <B>Entreguei só uma parte</B>, marque o que ficou. O total e o troco são recalculados.</li>
          <li>Ninguém em casa, endereço errado: <B>Não consegui entregar</B>, escolha o motivo. O pedido volta para a loja.</li>
          <li>Pix: <B>Mostrar QR do Pix para o cliente</B>. O Pix só conta depois que a loja conferir no extrato.</li>
        </ol>
        <p>No topo fica quanto dinheiro você deve ter em mãos agora. É esse valor que o caixa vai contar no acerto.</p>
        <h3>Entregador sem celular</h3>
        <p>Ninguém é obrigado a usar o celular pessoal. Em <B>Equipe</B>, marque <B>Trabalha sem celular</B> ao cadastrar: ele não entra no sistema.</p>
        <ol>
          <li>Depois de despachar, em <B>Entregas</B>, clique em <B>Folha da rota</B> ao lado do nome dele e imprima. A folha tem endereço, telefone, o que levar, quanto cobrar, o troco e o QR do Pix de cada pedido.</li>
          <li>Na rua, ele marca à caneta: entregue, só uma parte ou não entregue.</li>
          <li>Na volta, lance cada pedido em <B>Entregas</B> ou no acerto dele: <B>Entregue</B>, ou <B>Parcial ou não entregue</B>. Depois feche o acerto normalmente.</li>
        </ol>
      </>
    ),
  },
  {
    id: "caixa",
    titulo: "Caixa: turnos e acertos",
    perfis: ["caixa", "dono"],
    corpo: (
      <>
        <h3>Começo do dia</h3>
        <p>Em <B>Caixa e acertos</B>, escolha o entregador, informe o <B>Troco inicial</B> e clique em <B>Abrir turno</B>. Sem turno aberto ele não recebe pedidos.</p>
        <h3>Durante o dia</h3>
        <ul>
          <li>Entregador deixou dinheiro: abra o turno dele e use <B>Registrar repasse</B>.</li>
          <li>Pagou gasolina ou outra despesa com o dinheiro das entregas: <B>Registrar gasto</B>, com o comprovante.</li>
          <li>Pix: confira no extrato do banco e clique em <B>Pix conferido no extrato</B> no pedido. Nunca confirme por foto de comprovante.</li>
        </ul>
        <h3>Fechar o acerto</h3>
        <ol>
          <li>O entregador não pode estar com pedido em rota.</li>
          <li>Conte o dinheiro na frente dele e digite em <B>Dinheiro contado</B>. O sistema mostra na hora se bateu, se falta ou se sobra.</li>
          <li>Com diferença, a observação é obrigatória: escreva o que ele explicou. A diferença fica pendente até o dono resolver; ninguém é culpado automaticamente.</li>
          <li>O próprio entregador nunca fecha o próprio acerto.</li>
        </ol>
        <p>Fiado: pagamentos entram em <B>Fiado</B>, no nome do cliente.</p>
      </>
    ),
  },
  {
    id: "dono",
    titulo: "Dono: controle e decisões",
    perfis: ["dono"],
    corpo: (
      <>
        <ul>
          <li><B>Painel</B>: o dia em números, com filtro por dia e por entregador. Alertas em vermelho e amarelo levam direto ao problema.</li>
          <li>Diferença de acerto: em <B>Caixa e acertos</B>, abra o acerto e diga <B>Como foi resolvido</B>.</li>
          <li><B>Estornar pedido</B>, ajuste de estoque e inventário pedem sua senha de novo. O registro nunca é apagado: o estorno cria um lançamento ao contrário.</li>
          <li>Estoque: faça inventário com frequência em <B>Estoque</B>. Só as diferenças viram ajuste, com motivo.</li>
          <li><B>Produtos e preços</B> e <B>Equipe</B> (incluir pessoas, redefinir senha, desativar quem saiu) ficam no menu, em Gestão.</li>
          <li>A engrenagem no alto do menu (<B>Configurações</B>) reúne o que se ajusta uma vez: <B>Regras da casa</B> (limite de desconto, prazo de atraso), <B>Pagamentos</B> (chave Pix, Mercado Pago), <B>Pedidos pelo site</B> e <B>Filiais</B>.</li>
          <li><B>Relatórios</B>: vendas por dia, entregador e produto; <B>Fechamento do dia</B> para imprimir; vendas em planilha.</li>
          <li><B>Auditoria</B>: quem fez o quê e quando, com o antes e depois de preços e ajustes.</li>
          <li>Comodato de antes do sistema: na tela do cliente, <B>Registrar comodato que já existia</B>, com sua senha. Não mexe no estoque; os vasilhames emprestados aparecem em <B>Em comodato</B> no estoque.</li>
          <li>Ative a verificação em duas etapas em <B>Trocar senha</B>: é a sua conta que aprova o caixa.</li>
        </ul>
        <h3>Filiais</h3>
        <ul>
          <li>Na engrenagem, <B>Filiais</B> e <B>Nova filial</B>. Cada filial tem o próprio estoque, equipe, turnos e despesas; clientes, produtos e preços valem para todas.</li>
          <li>Com mais de uma filial, o menu ganha a escolha da filial: tudo que você vê e lança passa a ser dela. A equipe só vê a filial onde trabalha.</li>
          <li>Em <B>Equipe</B>, cada pessoa tem sua filial; use <B>Mudar de filial</B> para trocar (entregador só depois do acerto).</li>
          <li>Cada filial ganha o próprio link de pedidos, na engrenagem, em <B>Pedidos pelo site</B>. Em <B>Relatórios</B> e <B>Despesas</B>, escolha <B>Todas as filiais</B> para ver a empresa somada.</li>
        </ul>
      </>
    ),
  },
  {
    id: "contingencia",
    titulo: "Quando algo dá errado",
    perfis: ["atendente", "caixa", "entregador", "dono"],
    corpo: (
      <>
        <h3>Celular do entregador sem sinal</h3>
        <p>Pode tocar em <B>Entreguei</B> normalmente. A confirmação fica guardada no celular e é enviada sozinha quando o sinal voltar, sem duplicar. Não feche o navegador até ela sair.</p>
        <h3>Sistema fora do ar ou internet da loja caiu</h3>
        <ol>
          <li>Não pare de vender. Anote cada pedido no papel: hora, cliente, endereço, produtos, pagamento, troco e entregador.</li>
          <li>Cada entregador anota o que recebeu em dinheiro.</li>
          <li>Quando voltar, lance todos os pedidos na ordem, com <B>Observações</B> “lançado depois, sistema fora”, despache e confirme as entregas.</li>
          <li>Só então feche os acertos. Guarde as folhas até o fim do mês.</li>
          <li>Avise a Solace se a queda passar de 15 minutos.</li>
        </ol>
        <h3>Dinheiro não bateu</h3>
        <p>Feche o acerto com o valor contado e escreva a explicação. Confira os pedidos do turno (pagamento misto, troco, entrega parcial) antes de qualquer conclusão. O dono decide o que fazer com a diferença.</p>
        <h3>Botijão ou galão danificado</h3>
        <p>Em <B>Estoque</B>, <B>Registrar avaria</B>: ele sai de cheios ou vazios e vai para avariados, com o defeito descrito.</p>
        <h3>Esqueceu a senha</h3>
        <p>Peça ao dono para redefinir em <B>Equipe</B>. Se for o dono, fale com a Solace.</p>
      </>
    ),
  },
];

export default async function Ajuda() {
  const user = await requireUser();
  const minhas = secoes.filter((s) => s.perfis.includes(user.role));
  // a seção do próprio perfil vem primeiro; as outras ficam depois, para quem cobre folga
  const ordem = [...minhas.filter((s) => s.id === user.role), ...minhas.filter((s) => s.id !== user.role)];
  const voltar = user.role === "entregador" ? "/entregador" : "/";

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href={voltar} aria-label="Voltar ao sistema" className="alvo">
            <Logo />
          </Link>
          <Link href={voltar} className="btn h-9 text-[13px]">Voltar ao sistema</Link>
        </div>
      </header>
      <main className="stagger mx-auto max-w-3xl px-6 py-12">
        <p className="text-[13px] text-muted">Manual de operação, {roleLabel[user.role].toLowerCase()}</p>
        <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.03em]">Como usar o Depósito</h1>
        <p className="mt-2 max-w-xl text-muted">O passo a passo de cada função e o que fazer quando algo sai do normal. Começa pelo que é seu.</p>
        <nav aria-label="Seções" className="mt-8 flex flex-wrap gap-2">
          {ordem.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="btn h-9 text-[13px]">{s.titulo.split(":")[0]}</a>
          ))}
        </nav>
        <article className="legal manual mt-10">
          {ordem.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <h2>{s.titulo}</h2>
              {s.corpo}
            </section>
          ))}
        </article>
      </main>
    </div>
  );
}
