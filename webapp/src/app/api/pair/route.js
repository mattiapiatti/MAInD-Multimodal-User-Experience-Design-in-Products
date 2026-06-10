import { NextResponse } from "next/server";
import { claimPairingCode } from "@/lib/data/devices";

// Public endpoint the Arduino Uno Q calls to claim a pairing code shown in the
// app. No user session: the code itself is the bearer of authorization, and the
// hardwareId uniqueness enforces exclusive ownership.
//
//   POST /api/pair  { "code": "ABC234", "hardwareId": "AA:BB:CC:.." }
//   -> 200 { ok: true, deviceToken }   (token presented on the WS handshake)
//   -> 4xx { ok: false, error }
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const code = String(body?.code || "").trim().toUpperCase();
  const hardwareId = String(body?.hardwareId || "").trim();
  if (!code || !hardwareId) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      { status: 400 },
    );
  }

  const res = claimPairingCode(code, hardwareId);
  if (!res.ok) {
    const status = res.error === "device_taken" ? 409 : 400;
    return NextResponse.json(res, { status });
  }
  return NextResponse.json(res);
}
