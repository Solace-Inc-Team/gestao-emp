import { formatBRL } from "./money.ts";

// Texto de cada registro da auditoria, para o dono ler sem saber o nome técnico da ação.
// `nomes` traz o nome de quem/o quê aparece só como id no registro (entregador, produto, cliente).

export type Linha = { titulo: string; detalhes: string[]; mudancas: [campo: string, antes: string, depois: string][] };
type Dados = Record<string, unknown> | null | undefined;

export const areas = {
  pedido: "Pedidos",
  turno: "Caixa e acertos",
  estoque: "Estoque",
  produto: "Produtos e preços",
  fiado: "Fiado",
  despesa: "Despesas",
  cliente: "Clientes",
  usuario: "Equipe e acessos",
  empresa: "Empresa e configurações",
  fornecedor: "Fornecedores",
  termos: "Termos",
} as const;
export type Area = keyof typeof areas;

const estados: Record<string, string> = { cheio: "cheios", vazio: "vazios", avariado: "avariados" };
// "1 vazio", "3 vazios"
const qtd = (n: unknown, estado: string) => (typeof n === "number" ? `${n} ${n === 1 ? estado : (estados[estado] ?? estado)}` : "-");
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const metodos: Record<string, string> = { dinheiro: "dinheiro", pix: "Pix", cartao: "cartão", fiado: "fiado", boleto: "boleto" };
const resolucoes: Record<string, string> = {
  recebido: "entregador pagou a diferença",
  descontado: "será descontado do entregador",
  erro_contagem: "erro de contagem ou de lançamento",
  assumido: "a empresa assume a diferença",
  sobra: "sobra recolhida ao caixa",
};

const din = (v: unknown) => (typeof v === "number" ? formatBRL(v) : "-");
const num = (v: unknown) => (typeof v === "number" ? String(v) : "-");
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
const sinal = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

const camposProduto: [chave: string, rotulo: string, f: (v: unknown) => string][] = [
  ["name", "Nome", (v) => txt(v) || "-"],
  ["priceCents", "Preço", din],
  ["containerPriceCents", "Preço do vasilhame", din],
  ["minStock", "Estoque mínimo", num],
  ["returnable", "Retornável", (v) => (v ? "sim" : "não")],
  ["active", "À venda", (v) => (v ? "sim" : "não")],
];
const camposRegras: [chave: string, rotulo: string, f: (v: unknown) => string][] = [
  ["staffDiscountPct", "Desconto máximo da equipe", (v) => (typeof v === "number" ? `${v}%` : "-")],
  ["lateAfterMinutes", "Pedido atrasado depois de", (v) => (typeof v === "number" ? `${v} min` : "-")],
  ["pixKey", "Chave Pix", (v) => txt(v) || "(vazia)"],
  ["pixName", "Recebedor do Pix", (v) => txt(v) || "(vazio)"],
  ["pixCity", "Cidade do Pix", (v) => txt(v) || "(vazia)"],
  ["portalEnabled", "Pedido pelo site", (v) => (v ? "ligado" : "desligado")],
];

export function descrever(action: string, dados: Dados, nomes: Record<string, string> = {}, alvo = ""): Linha {
  const d = (dados ?? {}) as Record<string, unknown>;
  const nome = (id: unknown) => (typeof id === "string" && nomes[id]) || "alguém";
  const l: Linha = { titulo: action, detalhes: [], mudancas: [] };
  const det = (s: string) => s && l.detalhes.push(s);

  switch (action) {
    case "pedido.criar":
      l.titulo = `Lançou o pedido ${alvo}`;
      det(`Total ${din(d.total)}${d.mode === "balcao" ? ", venda no balcão" : ""}`);
      if (typeof d.discount === "number") det(`Desconto de ${din(d.discount)}`);
      break;
    case "pedido.saida":
      l.titulo = `Despachou o pedido ${alvo}`;
      det(`Com ${nome(d.driverId)}`);
      break;
    case "pedido.trocar_entregador":
      l.titulo = `Trocou o entregador do pedido ${alvo}`;
      l.mudancas.push(["Entregador", nome(d.from), nome(d.to)]);
      break;
    case "pedido.ocorrencia":
      l.titulo = `Devolveu à fila o pedido ${alvo}`;
      det(txt(d.kind).replaceAll("_", " "));
      det(txt(d.note));
      break;
    case "pedido.entregue":
      l.titulo = `Confirmou a entrega do pedido ${alvo}`;
      break;
    case "pedido.entrega_parcial":
      l.titulo = `Registrou entrega parcial do pedido ${alvo}`;
      l.mudancas.push(["Total", din(d.before), din(d.after)]);
      det(txt(d.note));
      break;
    case "pedido.pix_conferido":
      l.titulo = `Conferiu o Pix do pedido ${alvo} no extrato`;
      break;
    case "pedido.cancelar":
      l.titulo = `Cancelou o pedido ${alvo}`;
      det(txt(d.reason) && `Motivo: ${txt(d.reason)}`);
      break;
    case "pedido.estornar":
      l.titulo = `Estornou o pedido ${alvo}`;
      det(txt(d.reason) && `Motivo: ${txt(d.reason)}`);
      det(d.restock ? "Produtos voltaram ao estoque" : "Produtos não voltaram ao estoque");
      break;

    case "turno.abrir":
      l.titulo = `Abriu o turno de ${nome(d.driverId)}`;
      det(`Troco inicial ${din(d.openingCashCents)}`);
      break;
    case "turno.repasse":
      l.titulo = `Recebeu repasse de ${alvo || "entregador"}`;
      det(din(d.amountCents));
      break;
    case "turno.saida":
      l.titulo = `Registrou gasto autorizado de ${alvo || "entregador"}`;
      det(din(d.amountCents));
      break;
    case "turno.estornar_lancamento":
      l.titulo = `Estornou um lançamento do turno de ${alvo || "entregador"}`;
      det(txt(d.reason) && `Motivo: ${txt(d.reason)}`);
      break;
    case "turno.acerto": {
      l.titulo = `Fechou o acerto de ${alvo || "entregador"}`;
      det(`Esperado ${din(d.expected)}, contado ${din(d.countedCashCents)}`);
      const diff = typeof d.diff === "number" ? d.diff : 0;
      det(diff === 0 ? "Sem diferença" : diff < 0 ? `Falta de ${din(-diff)}` : `Sobra de ${din(diff)}`);
      break;
    }
    case "turno.resolver_diferenca":
      l.titulo = `Resolveu a diferença do acerto de ${alvo || "entregador"}`;
      det(resolucoes[txt(d.resolution)] ?? txt(d.resolution));
      det(txt(d.notes));
      break;

    case "estoque.ajuste": {
      l.titulo = `Ajustou o estoque de ${alvo}`;
      const antes = typeof d.before === "number" ? d.before : NaN;
      const delta = typeof d.delta === "number" ? d.delta : NaN;
      l.mudancas.push([maiuscula(estados[txt(d.state)] ?? "quantidade"), num(antes), `${num(d.counted)} (${Number.isNaN(delta) ? "?" : sinal(delta)})`]);
      det(txt(d.reason) && `Motivo: ${txt(d.reason)}`);
      break;
    }
    case "estoque.compra":
      l.titulo = `Registrou entrada de compra de ${alvo}`;
      det(`${qtd(d.full, "cheio")}${typeof d.emptiesReturned === "number" && d.emptiesReturned > 0 ? `, ${d.emptiesReturned} vazios devolvidos` : ""}`);
      if (typeof d.costCents === "number" && d.costCents > 0) det(`Custo ${din(d.costCents)} (${metodos[txt(d.costMethod)] ?? txt(d.costMethod)})`);
      det(txt(d.note));
      break;
    case "estoque.avaria":
      l.titulo = `Registrou avaria em ${alvo}`;
      det(qtd(d.quantity, txt(d.from)));
      det(txt(d.note));
      break;
    case "estoque.inventario": {
      l.titulo = "Registrou inventário";
      const diffs = Array.isArray(d.diffs) ? (d.diffs as Record<string, unknown>[]) : [];
      det(diffs.length ? `${diffs.length} ${diffs.length === 1 ? "diferença ajustada" : "diferenças ajustadas"}` : "Tudo bateu, nada ajustado");
      for (const x of diffs) l.mudancas.push([`${txt(x.product)} ${estados[txt(x.state)] ?? ""}`.trim(), num(x.before), num(x.counted)]);
      det(txt(d.note));
      break;
    }

    case "produto.criar":
      l.titulo = `Cadastrou o produto ${txt(d.name) || alvo}`;
      det(`Preço ${din(d.priceCents)}`);
      break;
    case "produto.editar": {
      const antes = (d.before ?? {}) as Record<string, unknown>;
      const depois = (d.after ?? {}) as Record<string, unknown>;
      l.titulo = `Alterou o produto ${txt(depois.name) || txt(antes.name) || alvo}`;
      for (const [k, rotulo, f] of camposProduto) if (k in depois && f(antes[k]) !== f(depois[k])) l.mudancas.push([rotulo, f(antes[k]), f(depois[k])]);
      if (!l.mudancas.length) det("Salvou sem mudar nada");
      break;
    }

    case "fiado.pagamento":
      l.titulo = `Recebeu pagamento de fiado de ${alvo}`;
      det(`${din(d.amountCents)} em ${metodos[txt(d.method)] ?? txt(d.method)}`);
      if (typeof d.before === "number" && typeof d.amountCents === "number") l.mudancas.push(["Saldo devedor", din(d.before), din(Math.max(0, d.before - d.amountCents))]);
      break;
    case "fiado.estorno_pagamento":
      l.titulo = `Estornou um pagamento de fiado de ${alvo}`;
      det(din(d.amountCents));
      det(txt(d.reason) && `Motivo: ${txt(d.reason)}`);
      break;

    case "despesa.criar":
      l.titulo = `Lançou a despesa ${txt(d.description) || alvo}`;
      det(`${din(d.amountCents)} em ${metodos[txt(d.method)] ?? txt(d.method)}`);
      break;
    case "despesa.cancelar":
      l.titulo = `Cancelou uma despesa`;
      det(txt(d.reason) && `Motivo: ${txt(d.reason)}`);
      break;

    case "cliente.criar":
      l.titulo = `Cadastrou o cliente ${alvo}`;
      if (d.origin === "portal") det("Pelo pedido no site");
      break;
    case "cliente.editar":
      l.titulo = `Editou o cadastro de ${alvo}`;
      break;
    case "cliente.endereco":
      l.titulo = `Adicionou um endereço para ${alvo}`;
      break;
    case "cliente.remover_endereco":
      l.titulo = `Removeu um endereço de ${alvo}`;
      break;
    case "cliente.anonimizar":
      l.titulo = "Apagou os dados pessoais de um cliente";
      break;

    case "usuario.criar":
      l.titulo = `Cadastrou ${alvo} na equipe`;
      det(`Perfil: ${txt(d.role)}`);
      break;
    case "usuario.redefinir_senha":
      l.titulo = `Redefiniu a senha de ${alvo}`;
      break;
    case "usuario.ativar":
      l.titulo = `Reativou o acesso de ${alvo}`;
      break;
    case "usuario.desativar":
      l.titulo = `Desativou o acesso de ${alvo}`;
      break;
    case "termos.aceite":
      l.titulo = "Aceitou os termos de uso";
      det(txt(d.version) && `Versão ${txt(d.version)}`);
      break;

    case "empresa.regras":
      l.titulo = "Alterou as configurações da empresa";
      for (const [k, rotulo, f] of camposRegras) if (k in d) l.detalhes.push(`${rotulo}: ${f(d[k])}`);
      break;
    case "empresa.criar":
      l.titulo = "Solace criou a empresa";
      break;
    case "empresa.suspender":
      l.titulo = "Solace suspendeu a empresa";
      break;
    case "empresa.reativar":
      l.titulo = "Solace reativou a empresa";
      break;
    case "empresa.redefinir_acesso_dono":
      l.titulo = "Solace redefiniu o acesso do dono";
      break;
    case "empresa.exportar":
      l.titulo = "Exportou os dados da empresa";
      break;

    case "fornecedor.criar":
      l.titulo = `Cadastrou o fornecedor ${alvo}`;
      break;
    case "fornecedor.editar":
      l.titulo = `Editou o fornecedor ${alvo}`;
      break;
  }
  return l;
}
