"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { DownloadIcon } from "@/components/shell/icons";

export default function DownloadReport() {
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
      a.download = "companion-report.pdf";
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

  return (
    <Button variant="primary" fullWidth loading={busy} onClick={download}>
      <DownloadIcon width={18} height={18} aria-hidden="true" />
      Download PDF
    </Button>
  );
}
