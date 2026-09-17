/**
 * TOTP (RFC 6238) — Web Crypto API 기반, 외부 의존성 없음.
 * Google Authenticator · Authy 등 표준 OTP 앱과 호환됩니다.
 *
 * 참고: 비밀키는 Firestore `users/{uid}.gwSettings.twoFASecret` 에 평문으로
 * 저장되고, 검증도 클라이언트에서 이뤄집니다. 데모/포트폴리오 수준의 2FA로,
 * 서버(Cloud Functions) 없이 브라우저에서 완결되는 구조라는 한계가 있습니다.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

/** 새 TOTP 비밀키 생성 (160bit → base32) */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** otpauth:// URI — Google Authenticator 등에서 QR로 스캔할 값 */
export function buildOtpAuthUri(opts: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = opts.issuer ?? "CoreFlow";
  const label = `${issuer}:${opts.accountName}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, message as BufferSource);
  return new Uint8Array(sig);
}

/** 8바이트 빅엔디언 카운터 (BigInt 없이 — 낮은 4바이트만 실사용) */
function counterBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let low = counter;
  for (let i = 7; i >= 4; i--) {
    bytes[i] = low & 0xff;
    low = Math.floor(low / 256);
  }
  return bytes;
}

/** 지정 시각 기준 6자리 TOTP 코드 생성 (30초 단위) */
export async function totpAt(
  secret: string,
  atMs = Date.now(),
  periodSec = 30,
): Promise<string> {
  const counter = Math.floor(atMs / 1000 / periodSec);
  const key = base32Decode(secret);
  const hmac = await hmacSha1(key, counterBytes(counter));
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

/** 앞뒤 1 스텝(±30초)까지 시계 오차를 허용하는 TOTP 코드 검증 */
export async function verifyTotp(
  secret: string,
  token: string,
  window = 1,
): Promise<boolean> {
  const clean = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const now = Date.now();
  for (let step = -window; step <= window; step++) {
    const candidate = await totpAt(secret, now + step * 30_000);
    if (candidate === clean) return true;
  }
  return false;
}

/** N개의 사람이 읽기 쉬운 백업 코드 생성 (예: A1B2-C3D4) */
export function generateBackupCodes(count = 8): string[] {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동되는 0/O, 1/I 제외
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    let raw = "";
    for (const b of bytes) raw += chars[b % chars.length];
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

/** 백업 코드는 평문 대신 SHA-256 해시로만 저장/비교합니다. */
export async function hashBackupCode(code: string): Promise<string> {
  const norm = code.trim().toUpperCase().replace(/\s+/g, "");
  const data = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
