import { getBackendDO } from "@/lib/env";

// Thin proxies to the backend Durable Object.

/** All devices owned by a user, newest first. */
export async function listDevices(userId) {
  const do_ = await getBackendDO();
  return do_.listDevices(userId);
}

/** Device-facing: start a pairing session → { code } (or { alreadyPaired }). */
export async function startPairing(hardwareId, deviceName) {
  const do_ = await getBackendDO();
  return do_.startPairing(hardwareId, deviceName);
}

/** Device-facing: poll a pairing session → { status, deviceToken? }. */
export async function pollPairing(hardwareId) {
  const do_ = await getBackendDO();
  return do_.pollPairing(hardwareId);
}

/**
 * App-facing: claim the code shown on the device, binding it to the user.
 * Exclusive: a hardware unit can only belong to one account.
 */
export async function claimCode(userId, code, deviceName) {
  const do_ = await getBackendDO();
  return do_.claimCode(userId, code, deviceName);
}

/** Unpair (delete) a device the user owns. */
export async function removeDevice(userId, deviceId) {
  const do_ = await getBackendDO();
  return do_.removeDevice(userId, deviceId);
}
