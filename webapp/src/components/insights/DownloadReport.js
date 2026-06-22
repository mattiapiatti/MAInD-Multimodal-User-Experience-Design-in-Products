"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { DownloadIcon } from "@/components/shell/icons";
import styles from "./DownloadReport.module.css";

export default function DownloadReport({ icon = false }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch("/api/report");
      if (!res.ok) throw new Error("report failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kai-report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (icon) {
    return (
      <button
        type="button"
        className={styles.cta}
        onClick={download}
        disabled={busy}
      >
        <DownloadIcon width={16} height={16} aria-hidden="true" />
        Download PDF
      </button>
    );
  }

  return (
    <Button variant="primary" fullWidth loading={busy} onClick={download}>
      <DownloadIcon width={18} height={18} aria-hidden="true" />
      Download PDF
    </Button>
  );
}
