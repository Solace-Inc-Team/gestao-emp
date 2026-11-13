// Cliente mínimo da API do Mercado Pago: só o que o Pix do pedido usa. Cada chamada leva o token da
// própria empresa; o dinheiro cai na conta dela. Documentação: https://www.mercadopago.com.br/developers

const API = "https://api.mercadopago.com";

export class ErroMp extends Error {
  constructor(
    message: string,
    readonly tokenInvalido = false,
  ) {
    super(message);
  }
}

// os testes trocam a rede por um Mercado Pago de mentira
let rede: typeof fetch = (...a) => fetch(...a);
export const usarRede = (f: typeof fetch) => void (rede = f);

async function chamar<T>(token: string, caminho: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await rede(API + caminho, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ErroMp("O Mercado Pago não respondeu.");
  }
  if (res.status === 401 || res.status === 403) throw new ErroMp("O Mercado Pago recusou o token.", true);
  if (!res.ok) throw new ErroMp(`O Mercado Pago respondeu ${res.status}.`);
  return (await res.json()) as T;
}

/** Dono do token: confere que ele vale e diz a qual conta a empresa está ligando. */
export async function contaMp(token: string) {
  const r = await chamar<{ id: number; nickname?: string; email?: string }>(token, "/users/me");
  return { id: String(r.id), nome: r.email || r.nickname || `conta ${r.id}` };
}

export type NovoPix = {
  valorCents: number;
  descricao: string;
  /** id do pedido: volta na consulta e prova de qual pedido é o pagamento */
  referencia: string;
  emailPagador: string;
  expiraEm: Date;
  /** endereço público (https) para o aviso de pagamento; sem ele, a confirmação vem pela consulta */
  avisoUrl?: string;
  /** mesma chave = mesma cobrança: dois cliques não criam dois Pix */
  chave: string;
};

/** Cria a cobrança Pix e devolve o código copia e cola. */
export async function criarPixMp(token: string, p: NovoPix) {
  const r = await chamar<{ id: number; status: string; point_of_interaction?: { transaction_data?: { qr_code?: string } } }>(token, "/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": p.chave },
    body: JSON.stringify({
      transaction_amount: p.valorCents / 100,
      description: p.descricao,
      payment_method_id: "pix",
      external_reference: p.referencia,
      date_of_expiration: p.expiraEm.toISOString().replace("Z", "+00:00"),
      payer: { email: p.emailPagador },
      ...(p.avisoUrl ? { notification_url: p.avisoUrl } : {}),
    }),
  });
  const codigo = r.point_of_interaction?.transaction_data?.qr_code;
  if (!codigo) throw new ErroMp("O Mercado Pago não devolveu o código Pix.");
  return { id: String(r.id), codigo };
}

/** Situação do pagamento: "approved" é Pix pago. */
export async function pagamentoMp(token: string, id: string) {
  const r = await chamar<{ status: string; external_reference?: string; transaction_amount: number }>(token, `/v1/payments/${encodeURIComponent(id)}`);
  return { pago: r.status === "approved", situacao: r.status, referencia: r.external_reference ?? "", valorCents: Math.round(r.transaction_amount * 100) };
}

/** Cancela uma cobrança que não vale mais (o total do pedido mudou). Se já tiver sido paga, o MP recusa. */
export async function cancelarPixMp(token: string, id: string) {
  await chamar(token, `/v1/payments/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
}
