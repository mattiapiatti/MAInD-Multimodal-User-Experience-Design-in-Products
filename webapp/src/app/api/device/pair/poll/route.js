import { NextResponse } from "next/server";
import { pollPairing } from "@/lib/data/devices";

// Device-facing. The unit polls this (with the same secret it sent to /start)
// after showing its code, until the user claims it. The token is returned at
// most once, and only to a caller presenting the matching secret.
//
//   POST /api/device/pair/poll  { "hardwareId": "..", "deviceSecret": "<random>" }
//   -> { status: "pending" | "expired" | "none" }
//   -> { status: "paired" }                 (claimed, but token already delivered)
//   -> { status: "paired", deviceToken }    (first poll after claim; stop polling)
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const hardwareId = String(body?.hardwareId || "").trim();
  const deviceSecret = String(body?.deviceSecret || "").trim();
  if (!hardwareId) {
    return NextResponse.json({ error: "missing_hardwareId" }, { status: 400 });
  }
  const res = await pollPairing(hardwareId, deviceSecret);
  return NextResponse.json(res);
}
