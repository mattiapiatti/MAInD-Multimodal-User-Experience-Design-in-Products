"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/guard";
import { startPairing, claimCode, removeDevice } from "@/lib/data/devices";
import { newId, newToken } from "@/lib/ids";

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
 * Demo without hardware: spin up a fake unit, run its pairing, and bind it to
 * the current account in a single step — no code to type. Collapses what a real
 * device (show code) + manual claim would do into one click.
 */
export async function simulateDeviceAction() {
  const user = await requireOnboardedUser();
  const hardwareId = `KAI-${newId().slice(0, 10).toUpperCase()}`;
  const { code } = await startPairing(hardwareId, newToken(), "Kai");
  const res = await claimCode(user.id, code);
  if (res.ok) revalidatePath("/device");
  return res;
}

export async function removeDeviceAction(deviceId) {
  const user = await requireOnboardedUser();
  await removeDevice(user.id, deviceId);
  revalidatePath("/device");
  return { ok: true };
}
