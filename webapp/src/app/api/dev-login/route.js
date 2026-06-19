import { NextResponse } from "next/server";
import { getEnv, getBackendDO } from "@/lib/env";
import { DEMO_EMAIL } from "@/lib/demo";

// DEMO ONLY — see BackendDO.devSignIn. Lets "Sign in" log straight into an
// account without the real password, for showcasing the app. Enabled on
// local/LAN automatically, or anywhere when DEMO_LOGIN=1; otherwise 404 so it
// can't be abused on the deployed site.

function isLocalHost(host) {
  const h = (host || "").split(":")[0];
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

export async function POST(request) {
  const env = await getEnv();
  const host = request.headers.get("host") || "";
  if (!isLocalHost(host) && env.DEMO_LOGIN !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let email = DEMO_EMAIL;
  try {
    const body = await request.json();
    if (body?.email) email = String(body.email);
  } catch {
    /* no body → fall back to the default demo email */
  }

  const do_ = await getBackendDO();
  const res = await do_.devSignIn(email);
  if (!res?.ok) {
    return NextResponse.json({ error: res?.error || "failed" }, { status: 400 });
  }

  const out = NextResponse.json({ ok: true });
  for (const cookie of res.cookies || []) out.headers.append("set-cookie", cookie);
  return out;
}

// DEMO ONLY — sign out by dropping all sessions server-side, so the existing
// browser cookie stops authenticating and the (prefilled) login screen shows.
export async function DELETE(request) {
  const env = await getEnv();
  const host = request.headers.get("host") || "";
  if (!isLocalHost(host) && env.DEMO_LOGIN !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const do_ = await getBackendDO();
  await do_.devSignOutAll();
  const out = NextResponse.json({ ok: true });
  // Best-effort clear of the cookie for callers that honour it (e.g. fetch).
  out.headers.append(
    "set-cookie",
    "voicebot.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
  );
  return out;
}
