"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guard";
import { startPairing, claimCode, removeDevice } from "@/lib/data/devices";
import { newId } from "@/lib/ids";

/**
 * The user types the code shown on the device's screen. Binds that device to
 * their account (exclusive).
 */
export async function claimCodeAction(code) {
  const user = await requireOnboardedUser();
  const clean = String(code || "").trim().toUpperCase();
  if (clean.length !== 6) return { ok: false, error: "invalid_code" };
  const res = await claimCode(user.id, clean);
  if (res.ok) revalidatePath("/device");
  return res;
}

/**
 * Demo without hardware: spin up a fake device that "starts pairing" and shows
 * a code on its (simulated) round screen. Returns the code to display; the user
 * then types it into the app, exactly as with a real unit.
 */
export async function simulateDeviceAction() {
  await requireOnboardedUser();
  const hardwareId = `SIM-${newId().slice(0, 10).toUpperCase()}`;
  const res = await startPairing(hardwareId, "Simulated unit");
  return { hardwareId, code: res.code, expiresAt: res.expiresAt };
}

export async function removeDeviceAction(deviceId) {
  const user = await requireOnboardedUser();
  await removeDevice(user.id, deviceId);
  revalidatePath("/device");
  return { ok: true };
}
