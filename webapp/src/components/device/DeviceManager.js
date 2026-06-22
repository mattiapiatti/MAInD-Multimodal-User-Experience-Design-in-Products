"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
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

  const hasDevice = devices.some((d) => d.status === "active");

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
    if (!confirm("Unpair this device?")) return;
    setBusy("remove");
    try {
      await removeDeviceAction(id);
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      {devices.length > 0 ? (
        <ul className={styles.list}>
          {devices.map((d) => (
            <li key={d.id} className={styles.deviceCard}>
              <div className={styles.itemBody}>
                <strong>{d.name || "Kai"}</strong>
                <div className={styles.statusRow}>
                  <span
                    className={styles.dot}
                    data-status={d.status}
                    aria-hidden="true"
                  />
                  <span className={styles.statusLabel}>
                    {d.status === "active"
                      ? "Connected · listening"
                      : "Not paired · tap to set up"}
                  </span>
                </div>
                <span className={styles.meta}>
                  {d.hardwareId} · since {formatDate(d.pairedAt)}
                </span>
                <button
                  className={styles.unlink}
                  onClick={() => remove(d.id)}
                  disabled={!!busy}
                >
                  Unpair
                </button>
              </div>
              <div className={styles.deviceArt}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/kai.png" alt="Kai voice device" width={521} height={560} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!hasDevice ? (
        <Card
          title="Pair a device"
          subtitle="Bring Kai online and link it to your account."
          padded
        >
          {error ? <Alert tone="error">{error}</Alert> : null}

          <div className={styles.pairKai}>
            <div className={styles.pairKaiText}>
              <p className={styles.pairKaiCopy}>
                Kai is your voice companion. Tap to pair it with this account.
              </p>
              <Button loading={busy === "sim"} onClick={pairKai}>
                Pair Kai
              </Button>
            </div>
            <div className={styles.pairKaiArt}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kai.png" alt="Kai voice device" width={521} height={560} />
            </div>
          </div>
        </Card>
      ) : null}

      <p className={styles.exclusivity}>
        Once paired, a device belongs exclusively to your account: it can&apos;t
        be linked to anyone else until you unpair it.
      </p>
    </>
  );
}
