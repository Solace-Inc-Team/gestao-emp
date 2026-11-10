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
    "equipe.csv": {
      header: ["Nome", "E-mail", "Perfil", "Ativo", "2FA ativo", "Criado em"],
      query: sql`select name, email, role, ${yes("active")}, ${yes("totp_enabled")}, ${when("created_at")} from users where tenant_id = ${t} order by created_at`,
    },
    "clientes.csv": {
      header: ["ID", "Nome", "Telefone", "Endereço", "Referência", "Observações", "Criado em"],
      query: sql`select id, name, phone, address, reference, notes, ${when("created_at")} from customers where tenant_id = ${t} order by name`,
    },
    "produtos.csv": {
      header: ["ID", "Nome", "Preço (R$)", "Retornável", "Estoque mínimo", "À venda", "Criado em"],
      query: sql`select id, name, ${money("price_cents")}, ${yes("returnable")}, min_stock, ${yes("active")}, ${when("created_at")} from products where tenant_id = ${t} order by name`,
    },
    "pedidos.csv": {
      header: [
        "Número", "Situação", "Cliente", "Entregador", "Pagamento", "Taxa de entrega (R$)", "Total (R$)", "Troco para (R$)",
        "Observações", "Motivo do cancelamento", "Motivo do estorno", "Lançado em", "Saiu em", "Entregue em", "Estornado em",
      ],
      query: sql`
        select o.number, o.status, c.name, u.name, o.payment_method, ${money("o.delivery_fee_cents")}, ${money("o.total_cents")},
               ${money("o.change_for_cents")}, o.notes, o.cancel_reason, o.refund_reason, ${when("o.created_at")}, ${when("o.dispatched_at")},
               ${when("o.delivered_at")}, ${when("o.refunded_at")}
        from orders o
        left join customers c on c.id = o.customer_id
        left join users u on u.id = o.driver_id
        where o.tenant_id = ${t} order by o.number`,
    },
    "itens_dos_pedidos.csv": {
      header: ["Pedido", "Produto", "Quantidade", "Preço unitário (R$)", "Cliente devolveu vazio"],
      query: sql`
        select o.number, p.name, i.quantity, ${money("i.unit_price_cents")}, ${yes("i.returns_empty")}
        from order_items i join orders o on o.id = i.order_id join products p on p.id = i.product_id
        where i.tenant_id = ${t} order by o.number`,
    },
    "turnos_e_acertos.csv": {
      header: [
        "Entregador", "Situação", "Troco inicial (R$)", "Esperado (R$)", "Contado (R$)", "Diferença (R$)", "Observação", "Conferido por",
        "Resolução da diferença", "Como foi resolvida", "Aberto em", "Fechado em", "Resolvida em",
      ],
      query: sql`
        select u.name, s.status, ${money("s.opening_cash_cents")}, ${money("s.expected_cash_cents")}, ${money("s.counted_cash_cents")},
               ${money("s.difference_cents")}, s.closing_notes, c.name, s.resolution, s.resolution_notes,
               ${when("s.opened_at")}, ${when("s.closed_at")}, ${when("s.resolved_at")}
        from shifts s join users u on u.id = s.driver_id left join users c on c.id = s.closed_by
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
      header: ["Data", "Produto", "Cheio ou vazio", "Onde", "Quantidade", "Motivo", "Pedido", "Por"],
      query: sql`
        select ${when("m.created_at")}, p.name, m.state, coalesce(d.name, 'Loja'), m.quantity, m.reason, o.number, u.name
        from stock_movements m
        join products p on p.id = m.product_id
        join users u on u.id = m.user_id
        left join users d on d.id = m.driver_id
        left join orders o on o.id = m.order_id
        where m.tenant_id = ${t} order by m.created_at`,
    },
    "pagamentos_de_fiado.csv": {
      header: ["Data", "Cliente", "Valor (R$)", "Forma", "Observação", "Recebido por", "Estornado em", "Motivo do estorno"],
      query: sql`
        select ${when("pm.created_at")}, c.name, ${money("pm.amount_cents")}, pm.method, pm.note, u.name, ${when("pm.voided_at")}, pm.void_reason
        from customer_payments pm join customers c on c.id = pm.customer_id join users u on u.id = pm.received_by
        where pm.tenant_id = ${t} order by pm.created_at`,
    },
    "despesas.csv": {
      header: ["Data", "Categoria", "Descrição", "Valor (R$)", "Forma", "Lançada por", "Cancelada em", "Motivo do cancelamento"],
      query: sql`
        select ${day("e.paid_on")}, e.category, e.description, ${money("e.amount_cents")}, e.method, u.name, ${when("e.voided_at")}, e.void_reason
        from expenses e join users u on u.id = e.created_by
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
