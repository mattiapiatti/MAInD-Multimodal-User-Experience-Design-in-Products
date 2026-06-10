// Web Crypto based id helpers — run on the Workers/Durable Object runtime
// (no node:crypto needed).

function randomBytes(n) {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

function toHex(bytes) {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function toBase64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** URL-safe opaque id (e.g. for devices). */
export function newId(prefix = "") {
  const raw = toHex(randomBytes(16));
  return prefix ? `${prefix}_${raw}` : raw;
}

/** Long random secret token presented by a device on the WS handshake. */
export function newToken() {
  return toBase64Url(randomBytes(32));
}

/** SHA-256 hex of an input — used to store the device pairing secret. */
export async function hashSecret(secret) {
  const data = new TextEncoder().encode(String(secret));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

/** Human-typeable pairing code: 6 chars, no ambiguous glyphs. */
export function newPairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
