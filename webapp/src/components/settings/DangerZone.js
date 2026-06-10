"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import {
  wipeHistoryAction,
  deleteAccountAction,
} from "@/app/(app)/settings/actions";
import styles from "./DangerZone.module.css";

export default function DangerZone() {
  const router = useRouter();
  const [msg, setMsg] = useState(null); // {tone, text}
  const [busy, setBusy] = useState("");

  async function wipe() {
    if (
      !confirm(
        "Erase the companion's history and memory? This can't be undone.",
      )
    )
      return;
    setBusy("wipe");
    setMsg(null);
    const res = await wipeHistoryAction();
    setBusy("");
    setMsg(
      res.ok
        ? { tone: "success", text: "Memory erased." }
        : {
            tone: "warning",
            text: "Companion unreachable: try again when the device is online.",
          },
    );
    router.refresh();
  }

  async function destroy() {
    if (
      !confirm(
        "Permanently delete your account? Profile, devices and data will be removed.",
      )
    )
      return;
    setBusy("delete");
    await deleteAccountAction(); // redirects on success
  }

  return (
    <div className={styles.zone}>
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

      <div className={styles.row}>
        <div className={styles.text}>
          <strong>Erase history and memory</strong>
          <span>
            Removes what the companion remembers about you. Profile and account
            stay.
          </span>
        </div>
        <Button variant="danger" loading={busy === "wipe"} onClick={wipe}>
          Erase
        </Button>
      </div>

      <div className={styles.row}>
        <div className={styles.text}>
          <strong>Delete account</strong>
          <span>Permanently removes your account, profile and devices.</span>
        </div>
        <Button variant="danger" loading={busy === "delete"} onClick={destroy}>
          Delete
        </Button>
      </div>
    </div>
  );
}
