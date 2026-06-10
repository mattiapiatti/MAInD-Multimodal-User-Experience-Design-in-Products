"use client";

import { useState } from "react";
import { signOut } from "@/lib/auth/client";
import Button from "@/components/ui/Button";

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    await signOut();
    // Hard navigation so the cleared session is reflected everywhere.
    window.location.assign("/login");
  }

  return (
    <Button variant="secondary" fullWidth loading={busy} onClick={onClick}>
      Sign out
    </Button>
  );
}
