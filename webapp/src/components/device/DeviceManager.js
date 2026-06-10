"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import {
  createCodeAction,
  simulatePairAction,
  removeDeviceAction,
} from "@/app/(app)/device/actions";
import styles from "./DeviceManager.module.css";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function DeviceManager({ devices }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hasDevice = devices.some((d) => d.status === "active");

  async function generate() {
    setError("");
    setBusy(true);
    try {
      const res = await createCodeAction(null);
      setCode(res.code);
    } catch {
      setError("Couldn't generate the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function simulate() {
    if (!code) return;
    setError("");
    setBusy(true);
    try {
      const res = await simulatePairAction(code);
      if (!res.ok) {
        setError(
          res.error === "device_taken"
            ? "This device is already paired to another account."
            : "Pairing failed. Generate a new code.",
        );
      } else {
        setCode("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm("Unpair this device?")) return;
    setBusy(true);
    try {
      await removeDeviceAction(id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {devices.length > 0 ? (
        <Card title="Paired devices" padded>
          <ul className={styles.list}>
            {devices.map((d) => (
              <li key={d.id} className={styles.item}>
                <span
                  className={styles.dot}
                  data-status={d.status}
                  aria-hidden="true"
                />
                <div className={styles.itemBody}>
                  <strong>{d.name || "Voice unit"}</strong>
                  <span className={styles.meta}>
                    {d.hardwareId} · since {formatDate(d.pairedAt)}
                  </span>
                </div>
                <button
                  className={styles.unlink}
                  onClick={() => remove(d.id)}
                  disabled={busy}
                >
                  Unpair
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!hasDevice ? (
        <Card
          title="Pair a device"
          subtitle="Connect your Arduino Uno Q voice unit to this account."
          padded
        >
          {error ? <Alert tone="error">{error}</Alert> : null}

          {!code ? (
            <>
              <ol className={styles.steps}>
                <li>Power on the unit and keep it on the same Wi-Fi.</li>
                <li>Generate a pairing code below.</li>
                <li>Enter the code on the unit to finish.</li>
              </ol>
              <Button fullWidth loading={busy} onClick={generate}>
                Generate pairing code
              </Button>
            </>
          ) : (
            <div className={styles.codeBox}>
              <span className={styles.codeLabel}>
                Enter this code on the unit
              </span>
              <div className={styles.code}>{code}</div>
              <span className={styles.codeHint}>Expires in 10 minutes</span>
              <Button
                fullWidth
                variant="secondary"
                loading={busy}
                onClick={simulate}
              >
                Simulate pairing (demo)
              </Button>
              <p className={styles.note}>
                No hardware? “Simulate” creates a test pairing. A real unit would
                send the code to <code>/api/pair</code>.
              </p>
            </div>
          )}
        </Card>
      ) : null}

      <p className={styles.exclusivity}>
        Once paired, a device belongs exclusively to your account: it can&apos;t
        be linked to anyone else until you unpair it.
      </p>
    </>
  );
}
