// Pix "copia e cola" (BR Code do Banco Central) gerado aqui mesmo, sem provedor:
// o cliente paga direto na chave da empresa e o pedido vai identificado no campo txid.

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do BR Code. */
export function crc16(text: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

// nome e cidade vão sem acento e com tamanho limitado, como pede o padrão
const plain = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .trim()
    .slice(0, max)
    .toUpperCase();

export function pixPayload(p: { key: string; name: string; city: string; amountCents: number; txid: string }) {
  const body =
    field("00", "01") +
    field("26", field("00", "br.gov.bcb.pix") + field("01", p.key.trim())) +
    field("52", "0000") +
    field("53", "986") +
    field("54", (p.amountCents / 100).toFixed(2)) +
    field("58", "BR") +
    field("59", plain(p.name, 25) || "RECEBEDOR") +
    field("60", plain(p.city, 15) || "BRASIL") +
    field("62", field("05", p.txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***")) +
    "6304";
  return body + crc16(body);
}
