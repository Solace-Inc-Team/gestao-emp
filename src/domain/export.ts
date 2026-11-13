import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { strToU8, zipSync } from "fflate";
import { db, pgClient } from "@/db";
import { auditLog } from "@/db/schema";
import { toCsv } from "@/lib/csv";

// Exportação completa de uma empresa (LGPD e saída de cliente): um CSV por assunto, num ZIP.
// Fica de fora o que não é dado do negócio: hash de senha, segredo de 2FA, sessões e tentativas de login.

const dialect = new PgDialect();
const money = (col: string) => sql.raw(`replace(round(${col} / 100.0, 2)::text, '.', ',')`);
// datas formatadas no banco, no fuso de Brasília, independente do fuso do servidor
const when = (col: string) => sql.raw(`to_char(${col} at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')`);
const day = (col: string) => sql.raw(`to_char(${col}, 'DD/MM/YYYY')`);
const yes = (col: string) => sql.raw(`case when ${col} then 'sim' else 'não' end`);

function tables(t: string): Record<string, { header: string[]; query: SQL }> {
  return {
    "empresa.csv": {
      header: ["Nome", "Criada em"],
      query: sql`select name, ${when("created_at")} from tenants where id = ${t}`,
    },
    "filiais.csv": {
      header: ["Nome", "Link de pedido (filial=)", "Principal", "Ativa", "Criada em"],
      query: sql`select name, slug, ${yes("main")}, ${yes("active")}, ${when("created_at")} from branches where tenant_id = ${t} order by created_at`,
    },
    "equipe.csv": {
      header: ["Nome", "E-mail", "Perfil", "Filial", "Ativo", "2FA ativo", "Criado em"],
      query: sql`
        select u.name, u.email, u.role, b.name, ${yes("u.active")}, ${yes("u.totp_enabled")}, ${when("u.created_at")}
        from users u left join branches b on b.id = u.branch_id
        where u.tenant_id = ${t} order by u.created_at`,
    },
    "clientes.csv": {
      header: ["ID", "Nome", "Telefone", "Endereço", "Referência", "Observações", "Criado em"],
      query: sql`select id, name, phone, address, reference, notes, ${when("created_at")} from customers where tenant_id = ${t} order by name`,
    },
    "enderecos_de_clientes.csv": {
      header: ["Cliente", "Nome do endereço", "Endereço", "Referência"],
      query: sql`
        select c.name, a.label, a.address, a.reference
        from customer_addresses a join customers c on c.id = a.customer_id
        where a.tenant_id = ${t} order by c.name`,
    },
    "produtos.csv": {
      header: ["ID", "Nome", "Preço (R$)", "Preço do vasilhame (R$)", "Retornável", "Estoque mínimo", "À venda", "Criado em"],
      query: sql`select id, name, ${money("price_cents")}, ${money("container_price_cents")}, ${yes("returnable")}, min_stock, ${yes("active")}, ${when("created_at")} from products where tenant_id = ${t} order by name`,
    },
    "fornecedores.csv": {
      header: ["Nome", "Telefone", "Observações", "Ativo", "Criado em"],
      query: sql`select name, phone, notes, ${yes("active")}, ${when("created_at")} from suppliers where tenant_id = ${t} order by name`,
    },
    "pedidos.csv": {
      header: [
        "Número", "Filial", "Situação", "Cliente", "Entregador", "Origem", "Pagamento", "Parte em dinheiro (R$)", "Taxa de entrega (R$)", "Desconto (R$)",
        "Motivo do desconto", "Total (R$)", "Troco para (R$)", "Endereço de entrega", "Última ocorrência",
        "Observações", "Motivo do cancelamento", "Motivo do estorno", "Lançado em", "Saiu em", "Entregue em", "Estornado em",
      ],
      query: sql`
        select o.number, b.name, o.status, c.name, u.name, o.origin, o.payment_method, ${money("o.cash_part_cents")}, ${money("o.delivery_fee_cents")},
               ${money("o.discount_cents")}, o.discount_reason, ${money("o.total_cents")},
               ${money("o.change_for_cents")}, coalesce(o.address, c.address), o.occurrence, o.notes, o.cancel_reason, o.refund_reason, ${when("o.created_at")}, ${when("o.dispatched_at")},
               ${when("o.delivered_at")}, ${when("o.refunded_at")}
        from orders o
        join branches b on b.id = o.branch_id
        left join customers c on c.id = o.customer_id
        left join users u on u.id = o.driver_id
        where o.tenant_id = ${t} order by o.number`,
    },
    "itens_dos_pedidos.csv": {
      header: ["Pedido", "Produto", "Quantidade pedida", "Quantidade entregue", "Preço unitário (R$)", "Cliente devolveu vazio", "Comodato"],
      query: sql`
        select o.number, p.name, i.quantity, coalesce(i.delivered_quantity, i.quantity), ${money("i.unit_price_cents")}, ${yes("i.returns_empty")}, ${yes("i.loan")}
        from order_items i join orders o on o.id = i.order_id join products p on p.id = i.product_id
        where i.tenant_id = ${t} order by o.number`,
    },
    "comodato.csv": {
      header: ["Data", "Cliente", "Produto", "Quantidade", "Caução (R$)", "Caução paga em", "Observação", "Por"],
      query: sql`
        select ${when("l.created_at")}, c.name, p.name, l.quantity, ${money("l.deposit_cents")}, l.deposit_method, l.note, u.name
        from container_loans l
        join customers c on c.id = l.customer_id
        join products p on p.id = l.product_id
        join users u on u.id = l.user_id
        where l.tenant_id = ${t} order by l.created_at`,
    },
    "turnos_e_acertos.csv": {
      header: [
        "Filial", "Entregador", "Situação", "Troco inicial (R$)", "Esperado (R$)", "Contado (R$)", "Diferença (R$)", "Observação", "Conferido por",
        "Resolução da diferença", "Como foi resolvida", "Aberto em", "Fechado em", "Resolvida em",
      ],
      query: sql`
        select b.name, u.name, s.status, ${money("s.opening_cash_cents")}, ${money("s.expected_cash_cents")}, ${money("s.counted_cash_cents")},
               ${money("s.difference_cents")}, s.closing_notes, c.name, s.resolution, s.resolution_notes,
               ${when("s.opened_at")}, ${when("s.closed_at")}, ${when("s.resolved_at")}
        from shifts s join branches b on b.id = s.branch_id join users u on u.id = s.driver_id left join users c on c.id = s.closed_by
        where s.tenant_id = ${t} order by s.opened_at`,
    },
    "repasses_e_saidas.csv": {
      header: ["Data", "Entregador", "Tipo", "Valor (R$)", "Observação", "Lançado por", "Estornado em", "Motivo do estorno"],
      query: sql`
        select ${when("e.created_at")}, d.name, e.kind, ${money("e.amount_cents")}, e.note, u.name, ${when("e.voided_at")}, e.void_reason
        from cash_entries e
        join shifts s on s.id = e.shift_id
        join users d on d.id = s.driver_id
        join users u on u.id = e.created_by
        where e.tenant_id = ${t} order by e.created_at`,
    },
    "movimentacoes_de_estoque.csv": {
      header: ["Data", "Filial", "Produto", "Estado", "Onde", "Quantidade", "Motivo", "Pedido", "Por"],
      query: sql`
        select ${when("m.created_at")}, b.name, p.name, m.state, coalesce(d.name, 'Loja'), m.quantity, m.reason, o.number, u.name
        from stock_movements m
        join branches b on b.id = m.branch_id
        join products p on p.id = m.product_id
        join users u on u.id = m.user_id
        left join users d on d.id = m.driver_id
        left join orders o on o.id = m.order_id
        where m.tenant_id = ${t} order by m.created_at`,
    },
    "pagamentos_de_fiado.csv": {
      header: ["Data", "Filial", "Cliente", "Valor (R$)", "Forma", "Observação", "Recebido por", "Estornado em", "Motivo do estorno"],
      query: sql`
        select ${when("pm.created_at")}, b.name, c.name, ${money("pm.amount_cents")}, pm.method, pm.note, u.name, ${when("pm.voided_at")}, pm.void_reason
        from customer_payments pm join branches b on b.id = pm.branch_id join customers c on c.id = pm.customer_id join users u on u.id = pm.received_by
        where pm.tenant_id = ${t} order by pm.created_at`,
    },
    "despesas.csv": {
      header: ["Data", "Filial", "Categoria", "Descrição", "Valor (R$)", "Forma", "Lançada por", "Cancelada em", "Motivo do cancelamento"],
      query: sql`
        select ${day("e.paid_on")}, b.name, e.category, e.description, ${money("e.amount_cents")}, e.method, u.name, ${when("e.voided_at")}, e.void_reason
        from expenses e join branches b on b.id = e.branch_id join users u on u.id = e.created_by
        where e.tenant_id = ${t} order by e.paid_on`,
    },
    "historico_de_alteracoes.csv": {
      header: ["Data", "Usuário", "Ação", "Registro", "ID do registro", "Detalhes"],
      query: sql`
        select ${when("a.created_at")}, u.name, a.action, a.entity, a.entity_id, a.data::text
        from audit_log a left join users u on u.id = a.user_id
        where a.tenant_id = ${t} order by a.created_at`,
    },
  };
}

const README = `Exportação completa dos dados da empresa no sistema Depósito.

Cada arquivo .csv abre direto no Excel ou no Google Planilhas (separador ";").
Valores estão em reais e datas no horário de Brasília.

Não estão incluídos: senhas, códigos de verificação em duas etapas e sessões de acesso.
`;

/** Gera o ZIP da empresa e registra a exportação no histórico. */
export async function exportTenant(by: { tenantId: string; userId: string }) {
  const files: Record<string, Uint8Array> = { "LEIA-ME.txt": strToU8(README) };
  const counts: Record<string, number> = {};
  for (const [name, { header, query }] of Object.entries(tables(by.tenantId))) {
    // linhas como listas: colunas de mesmo nome (cliente e entregador) não se sobrescrevem
    const q = dialect.sqlToQuery(query);
    const rows = (await pgClient.unsafe(q.sql, q.params as never[]).values()) as unknown[][];
    counts[name] = rows.length;
    files[name] = strToU8(toCsv(header, rows));
  }
  await db.insert(auditLog).values({ tenantId: by.tenantId, userId: by.userId, action: "empresa.exportar", entity: "tenant", entityId: by.tenantId, data: counts });
  return { zip: zipSync(files, { level: 6 }), counts };
}
