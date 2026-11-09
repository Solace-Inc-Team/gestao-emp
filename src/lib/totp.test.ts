import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Decode, base32Encode, newTotpSecret, totpCode, verifyTotp } from "./totp.ts";

// vetor da RFC 6238 (SHA1): segredo ASCII "12345678901234567890", 8 dígitos
const rfcSecret = base32Encode(Buffer.from("12345678901234567890"));

test("bate com os vetores oficiais da RFC 6238", () => {
  assert.equal(totpCode(rfcSecret, 59_000, 8), "94287082");
  assert.equal(totpCode(rfcSecret, 1111111109_000, 8), "07081804");
  assert.equal(totpCode(rfcSecret, 2000000000_000, 8), "69279037");
});

test("base32 vai e volta", () => {
  const s = newTotpSecret();
  assert.equal(base32Encode(base32Decode(s)), s);
});

test("aceita o código vizinho e recusa o resto", () => {
  const s = newTotpSecret();
  const now = 1_800_000_000_000;
  assert.ok(verifyTotp(s, totpCode(s, now), now));
  assert.ok(verifyTotp(s, totpCode(s, now - 30_000), now));
  assert.ok(!verifyTotp(s, totpCode(s, now - 120_000), now));
  assert.ok(!verifyTotp(s, "12345", now));
  assert.ok(!verifyTotp(s, "abcdef", now));
});
