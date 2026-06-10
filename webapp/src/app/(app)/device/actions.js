"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guard";
import {
  createPairingCode,
  claimPairingCode,
  renameDevice,
  removeDevice,
} from "@/lib/data/devices";
import { newId } from "@/lib/ids";

/** Generate a fresh pairing code for the current user. */
export async function createCodeAction(deviceName) {
  const user = await requireOnboardedUser();
  const { code, expiresAt } = createPairingCode(user.id, deviceName);
  return { code, expiresAt: expiresAt.toISOString() };
}

/**
 * Demo helper: simulate the Arduino claiming the code, so pairing can be shown
 * end-to-end without real hardware. A real unit calls POST /api/pair instead.
 */
export async function simulatePairAction(code) {
  await requireOnboardedUser();
  const fakeHardwareId = `SIM-${newId().slice(0, 12).toUpperCase()}`;
  const res = claimPairingCode(code, fakeHardwareId);
  revalidatePath("/device");
  return res;
}

export async function renameDeviceAction(deviceId, name) {
  const user = await requireOnboardedUser();
  renameDevice(user.id, deviceId, name);
  revalidatePath("/device");
  return { ok: true };
}

export async function removeDeviceAction(deviceId) {
  const user = await requireOnboardedUser();
  removeDevice(user.id, deviceId);
  revalidatePath("/device");
  return { ok: true };
}
