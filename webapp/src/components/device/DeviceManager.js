"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { simulateDeviceAction, removeDeviceAction } from "@/app/(app)/device/actions";
import styles from "./DeviceManager.module.css";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function DeviceManager({ devices }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function pairKai() {
    setError("");
    setBusy("sim");
    try {
      const res = await simulateDeviceAction();
      if (!res.ok) {
        setError(
          {
            device_taken: "This device is already paired to another account.",
          }[res.error] || "Pairing failed. Try again.",
        );
      } else {
        router.refresh();
      }
    } finally {
      setBusy("");
    }
  }

  async function remove(id) {
    // Unpair immediately — no confirmation prompt; the user can re-pair anytime.
    setBusy("remove");
    try {
      await removeDeviceAction(id);
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  const device = devices.find((d) => d.status === "active");

  return (
    <>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className={styles.deviceCard}>
        <div className={styles.itemBody}>
          <strong>Kai</strong>
          {device ? (
            <>
              <div className={styles.statusRow}>
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.statusLabel}>Connected · listening</span>
              </div>
              <span className={styles.meta}>
                {device.hardwareId} · since {formatDate(device.pairedAt)}
              </span>
              <div className={styles.action}>
                <Button
                  variant="danger"
                  loading={busy === "remove"}
                  onClick={() => remove(device.id)}
                >
                  Unpair
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.statusRow}>
                <span
                  className={styles.dot}
                  data-status="revoked"
                  aria-hidden="true"
                />
                <span className={styles.statusLabel}>Not paired yet</span>
              </div>
              <span className={styles.meta}>Tap to bring it online.</span>
              <div className={styles.action}>
                <Button loading={busy === "sim"} onClick={pairKai}>
                  Pair Kai
                </Button>
              </div>
            </>
          )}
        </div>
        <div className={styles.deviceArt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kai.png" alt="Kai voice device" width={521} height={560} />
        </div>
      </div>

      <p className={styles.exclusivity}>
        Once paired, Kai belongs exclusively to your account: it can&apos;t be
        linked to anyone else until you unpair it.
      </p>
    </>
  );
}
