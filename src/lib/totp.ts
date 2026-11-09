import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// TOTP (RFC 6238): o mesmo código que Google Authenticator, Authy e 1Password geram.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer) {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  const clean = s.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0,
    value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("base32 inválido");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export function totpCode(secret: string, time = Date.now(), digits = 6, step = 30) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / step)));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = h[h.length - 1] & 15;
  const n = (h.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(n).padStart(digits, "0");
}

/** Aceita o código atual e o de 30s antes/depois (relógio do celular adiantado ou atrasado). */
export function verifyTotp(secret: string, code: string, time = Date.now()) {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  // shortcut: não guarda o último código usado, então o mesmo código vale dentro da janela de ~90s; guardar o contador se precisar impedir reuso
  return [-1, 0, 1].some((d) => {
    const expected = totpCode(secret, time + d * 30_000);
    return timingSafeEqual(Buffer.from(expected), Buffer.from(clean));
  });
}

export const otpauthUri = (secret: string, account: string, issuer = "Depósito") =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
