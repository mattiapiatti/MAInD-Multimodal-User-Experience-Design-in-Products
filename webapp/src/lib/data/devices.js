import { getBackendDO } from "@/lib/env";

// Thin proxies to the backend Durable Object.

/** All devices owned by a user, newest first. */
export async function listDevices(userId) {
  const do_ = await getBackendDO();
  return do_.listDevices(userId);
}

/** Generate a fresh pairing code → { code, expiresAt }. */
export async function createPairingCode(userId, deviceName) {
  const do_ = await getBackendDO();
  return do_.createPairingCode(userId, deviceName);
}

/**
 * Claim a code on behalf of a device, binding hardwareId to the code's user.
 * Exclusive: a hardware unit can only belong to one account.
 */
export async function claimPairingCode(code, hardwareId) {
  const do_ = await getBackendDO();
  return do_.claimPairingCode(code, hardwareId);
}

/** Unpair (delete) a device the user owns. */
export async function removeDevice(userId, deviceId) {
  const do_ = await getBackendDO();
  return do_.removeDevice(userId, deviceId);
}
