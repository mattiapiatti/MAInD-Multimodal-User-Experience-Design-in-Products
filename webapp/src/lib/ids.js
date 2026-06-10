import { randomBytes, randomInt } from "node:crypto";

/** URL-safe opaque id (e.g. for devices). */
export function newId(prefix = "") {
  const raw = randomBytes(16).toString("hex");
  return prefix ? `${prefix}_${raw}` : raw;
}

/** Long random secret token presented by a device on the WS handshake. */
export function newToken() {
  return randomBytes(32).toString("base64url");
}

/** Human-typeable pairing code: 6 chars, no ambiguous glyphs. */
export function newPairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}
