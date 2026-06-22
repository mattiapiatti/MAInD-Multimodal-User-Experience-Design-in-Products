import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth/session";
import { getOnboarding } from "@/lib/data/onboarding";
import {
  getTimeline,
  getFrequencyByMonth,
  getSymptomDistribution,
} from "@/lib/mock/health";
import {
  CARE_CONTEXTS,
  METHOD_OPTIONS,
  STAGE_OPTIONS,
} from "@/lib/validation/onboarding";

// Generates a shareable PDF "appointment record" for the logged-in user.
// Data is currently the mock summary; the structure matches the future
// structured-memory source.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const profile = await getOnboarding(user.id);
  const timeline = getTimeline();
  const frequency = getFrequencyByMonth();
  const distribution = getSymptomDistribution();

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.1, 0.11, 0.1);
  const muted = rgb(0.42, 0.44, 0.43);
  const accent = rgb(0.055, 0.486, 0.4);
  const margin = 56;
  let y = 786;

  const text = (s, x, yy, { size = 11, f = font, color = ink } = {}) =>
    page.drawText(String(s), { x, y: yy, size, font: f, color });

  // Header
  text("Kai", margin, y, { size: 20, f: bold, color: accent });
  text("Appointment record", margin, y - 22, { size: 12, f: bold });
  text(
    `Generated on ${new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
    margin,
    y - 40,
    { size: 10, color: muted },
  );
  page.drawLine({
    start: { x: margin, y: y - 52 },
    end: { x: 539, y: y - 52 },
    thickness: 1,
    color: rgb(0.89, 0.9, 0.89),
  });
  y -= 78;

  // Profile. careContext/pronouns are multi-select arrays (tolerate legacy strings).
  const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const careLabel =
    asList(profile?.careContext)
      .map((v) => CARE_CONTEXTS.find((c) => c.value === v)?.label)
      .filter(Boolean)
      .join(", ") || "—";
  const methodLabel =
    asList(profile?.hormoneMethod)
      .map((v) => METHOD_OPTIONS.find((m) => m.value === v)?.label)
      .filter(Boolean)
      .join(", ") || "—";
  const stageLabel =
    STAGE_OPTIONS.find((s) => s.value === profile?.stage)?.label || "—";
  text("Profile", margin, y, { size: 13, f: bold });
  y -= 20;
  const rows = [
    ["Name", profile?.preferredName || user.name || "—"],
    ["Pronouns", asList(profile?.pronouns).join(", ") || "—"],
    ["Hormones / therapy", careLabel],
    ["Method", methodLabel],
    ["Where they are", stageLabel],
    ["Therapy start", profile?.therapyStartDate || "—"],
  ];
  for (const [k, v] of rows) {
    text(k, margin, y, { size: 10, color: muted });
    text(v, margin + 130, y, { size: 11 });
    y -= 18;
  }
  y -= 14;

  // Reported symptoms — distribution pie so the most frequent stands out.
  text("Reported symptoms", margin, y, { size: 13, f: bold });
  y -= 14;
  const total = distribution.reduce((s, d) => s + d.value, 0) || 1;
  const R = 56;
  const cx = margin + R + 4;
  const cy = y - R - 4;
  let a0 = -Math.PI / 2; // start at top
  for (const slice of distribution) {
    const frac = slice.value / total;
    const a1 = a0 + frac * Math.PI * 2;
    const x1 = (R * Math.cos(a0)).toFixed(2);
    const y1 = (R * Math.sin(a0)).toFixed(2);
    const x2 = (R * Math.cos(a1)).toFixed(2);
    const y2 = (R * Math.sin(a1)).toFixed(2);
    const large = frac > 0.5 ? 1 : 0;
    const d = `M 0 0 L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
    page.drawSvgPath(d, {
      x: cx,
      y: cy,
      color: rgb(...slice.color),
      borderColor: rgb(1, 1, 1),
      borderWidth: 1.5,
    });
    a0 = a1;
  }
  // Legend, right of the pie
  let ly = y - 6;
  const lx = cx + R + 28;
  for (const slice of distribution) {
    const pct = Math.round((slice.value / total) * 100);
    page.drawRectangle({
      x: lx,
      y: ly - 1,
      width: 9,
      height: 9,
      color: rgb(...slice.color),
    });
    text(slice.label, lx + 16, ly, { size: 10 });
    text(`${pct}%`, lx + 150, ly, { size: 10, color: muted });
    ly -= 18;
  }
  y = Math.min(cy - R, ly) - 16;

  // Frequency table
  text("Days with symptoms per month", margin, y, { size: 13, f: bold });
  y -= 20;
  for (const row of frequency) {
    text(row.month, margin, y, { size: 10, color: muted });
    const barW = row.days * 8;
    page.drawRectangle({
      x: margin + 60,
      y: y - 2,
      width: barW,
      height: 9,
      color: accent,
    });
    text(`${row.days} d`, margin + 64 + barW, y, { size: 9, color: muted });
    y -= 18;
  }
  y -= 14;

  // Timeline
  text("Recent events", margin, y, { size: 13, f: bold });
  y -= 20;
  for (const item of timeline) {
    text(item.date, margin, y, { size: 10, f: bold, color: accent });
    text(item.text, margin + 60, y, { size: 10 });
    y -= 18;
  }

  // Footer
  text(
    "Generated by Kai. This is not a substitute for medical advice.",
    margin,
    48,
    { size: 8, color: muted },
  );

  const bytes = await pdf.save();
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="kai-report.pdf"',
    },
  });
}
