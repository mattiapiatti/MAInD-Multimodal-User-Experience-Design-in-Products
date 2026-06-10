"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guard";
import { createPairingCode, claimPairingCode, removeDevice } from "@/lib/data/devices";
import { newId } from "@/lib/ids";

/** Generate a fresh pairing code for the current user → { code, expiresAt }. */
export async function createCodeAction(deviceName) {
  const user = await requireOnboardedUser();
  return createPairingCode(user.id, deviceName);
}

/**
 * Demo helper: simulate the device claiming the code, so pairing can be shown
 * end-to-end without real hardware. A real unit calls POST /api/pair instead.
 */
export async function simulatePairAction(code) {
  await requireOnboardedUser();
  const fakeHardwareId = `SIM-${newId().slice(0, 12).toUpperCase()}`;
  const res = await claimPairingCode(code, fakeHardwareId);
  revalidatePath("/device");
  return res;
}

export async function removeDeviceAction(deviceId) {
  const user = await requireOnboardedUser();
  await removeDevice(user.id, deviceId);
  revalidatePath("/device");
  return { ok: true };
}
