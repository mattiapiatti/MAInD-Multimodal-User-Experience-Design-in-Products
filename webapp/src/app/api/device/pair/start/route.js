import { NextResponse } from "next/server";
import { startPairing } from "@/lib/data/devices";

// Device-facing. The unit calls this on boot (when unpaired) to get a 6-char
// code to show on its circular screen. The device generates a high-entropy
// `deviceSecret` it keeps in memory and sends here; the token is later handed
// back via /poll only to a caller presenting that same secret. No token is ever
// returned from this endpoint.
//
//   POST /api/device/pair/start
//     { "hardwareId": "..", "deviceSecret": "<random>", "deviceName"?: ".." }
//   -> { code, expiresAt }   (show `code` on screen, then poll with the secret)
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const hardwareId = String(body?.hardwareId || "").trim();
  const deviceSecret = String(body?.deviceSecret || "").trim();
  if (!hardwareId || !deviceSecret) {
    return NextResponse.json(
      { error: "missing_fields" },
      { status: 400 },
    );
  }
  const deviceName = body?.deviceName ? String(body.deviceName).slice(0, 60) : null;
  const res = await startPairing(hardwareId, deviceSecret, deviceName);
  return NextResponse.json(res);
}
