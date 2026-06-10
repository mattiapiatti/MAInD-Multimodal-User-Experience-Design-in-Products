import { NextResponse } from "next/server";
import { startPairing } from "@/lib/data/devices";

// Device-facing. The unit calls this on boot (when unpaired) to get a 6-char
// code to show on its circular screen. If it's already bound to an account it
// gets its token back instead. No user session — the code shown on the physical
// device is what authorizes the binding (the user must read and type it).
//
//   POST /api/device/pair/start  { "hardwareId": "AA:BB:..", "deviceName"?: ".." }
//   -> { code, expiresAt }                 (show `code` on screen, then poll)
//   -> { alreadyPaired: true, deviceToken } (open the WS handshake with this)
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const hardwareId = String(body?.hardwareId || "").trim();
  if (!hardwareId) {
    return NextResponse.json({ error: "missing_hardwareId" }, { status: 400 });
  }
  const deviceName = body?.deviceName ? String(body.deviceName).slice(0, 60) : null;
  const res = await startPairing(hardwareId, deviceName);
  return NextResponse.json(res);
}
