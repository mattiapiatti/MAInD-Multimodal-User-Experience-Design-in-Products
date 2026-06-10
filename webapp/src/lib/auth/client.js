"use client";

import { createAuthClient } from "better-auth/client";

// baseURL omitted: the client uses the current origin (+ /api/auth), which is
// correct whether opened on localhost or via the host's LAN IP on a phone.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
