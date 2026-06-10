import { NextResponse } from "next/server";
import { pollPairing } from "@/lib/data/devices";

// Device-facing. The unit polls this after showing its code, until the user
// claims it in the app. Once claimed it receives its device token.
//
//   POST /api/device/pair/poll  { "hardwareId": "AA:BB:.." }
//   -> { status: "pending" | "expired" | "none" }
//   -> { status: "paired", deviceToken }   (stop polling; open the WS handshake)
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
  const res = await pollPairing(hardwareId);
  return NextResponse.json(res);
}
