"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import {
  claimCodeAction,
  simulateDeviceAction,
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
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sim, setSim] = useState(null); // { code } shown on the simulated screen

  const hasDevice = devices.some((d) => d.status === "active");

  async function pair(e) {
    e?.preventDefault();
    setError("");
    setBusy("pair");
    try {
      const res = await claimCodeAction(code);
      if (!res.ok) {
        setError(
          {
            device_taken: "This device is already paired to another account.",
            code_used: "That code was already used. Show a new one on the device.",
            code_expired: "That code expired. Show a new one on the device.",
            invalid_code: "Code not found. Check the 6 characters and try again.",
          }[res.error] || "Pairing failed. Try again.",
        );
      } else {
        setCode("");
        setSim(null);
        router.refresh();
      }
    } finally {
      setBusy("");
    }
  }

  async function simulate() {
    setError("");
    setBusy("sim");
    try {
      const res = await simulateDeviceAction();
      setSim({ code: res.code });
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
                  disabled={!!busy}
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
          subtitle="Your unit shows a 6-character code on its screen. Enter it here."
          padded
        >
          {error ? <Alert tone="error">{error}</Alert> : null}

          <form className={styles.pairForm} onSubmit={pair}>
            <input
              className={styles.codeInput}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
              }
              placeholder="ABC234"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              aria-label="Pairing code"
              maxLength={6}
            />
            <Button
              type="submit"
              fullWidth
              loading={busy === "pair"}
              disabled={code.length !== 6}
            >
              Pair device
            </Button>
          </form>

          <div className={styles.demo}>
            <p className={styles.demoLabel}>No device yet?</p>
            {sim ? (
              <div className={styles.screenWrap}>
                <div className={styles.screen} aria-label="Simulated device screen">
                  <span className={styles.screenHint}>Pairing code</span>
                  <span className={styles.screenCode}>{sim.code}</span>
                  <span className={styles.screenSub}>enter it in the app</span>
                </div>
                <p className={styles.note}>
                  This is what the round screen shows. Type the code above to
                  pair.
                </p>
              </div>
            ) : (
              <Button variant="secondary" loading={busy === "sim"} onClick={simulate}>
                Simulate a device
              </Button>
            )}
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
