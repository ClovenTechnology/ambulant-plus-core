// apps/clinician-app/components/MedicalDocs.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import Chart from "chart.js/auto"; // offscreen mini-chart -> image
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { normalizeVitals } from "@/lib/sfu/vitals";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// ---------------- types ----------------
type Vitals = {
  ts?: number;
  hr?: number;
  spo2?: number;
  tempC?: number;
  rr?: number;
  sys?: number;
  dia?: number;
};

export type DocType = "sick" | "fitness" | "rx";

export interface MedicalDocProps {
  encounterId?: string;
  clinicianName?: string;
  clinicianReg?: string;
  clinicName?: string;
  clinicLogoUrl?: string;
  clinicAddress?: string;
  patientId?: string;
  patientName?: string;
  patientHasIoMT?: boolean;
  initialSessionVitals?: Vitals[];
  onGenerated?: (meta: { filename: string; size: number; serverDoc?: any }) => void;
  uploadEndpoint?: string;

  /** NEW: Hide eRx option entirely (used when embedded under Conclusions → Medical Notes). */
  hideErx?: boolean;

  /** NEW: default selected document type (e.g. "sick") */
  defaultNoteType?: "none" | "sick" | "fitness";
}

// ---------------- constants ----------------
const CLINIC_NAME_DEFAULT = "Ambulant+ Center";
const CLINIC_ADDRESS_DEFAULT = "0B Meadowbrook Ln, Bryanston 2152, ZA";
const FOOTER_TEXT = (patientName?: string) =>
  `Generated for ${patientName || "patient"} on MedReach/CarePort via Ambulant+ Center (c) 2026 Cloven Technology Impilo +27 78 552 6420`;

// ---------------- helpers ----------------
const prettyDate = (d?: string) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
};

async function fetchImageAsDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    if (url.startsWith("data:")) return url;
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`Image fetch failed ${res.status}`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

function vitalsRows(vitals: Array<{ date: string; bp?: string; pulse?: number; temp?: number }>) {
  const rows = (vitals || [])
    .slice()
    .reverse()
    .map((v) => [prettyDate(v.date), v.bp ?? "—", v.pulse != null ? String(v.pulse) : "—", v.temp != null ? String(v.temp) : "—"]);
  return rows.length ? rows : [["—", "—", "—", "—"]];
}

async function tinyVitalsChartImage(vitals: Array<{ date: string; pulse?: number; temp?: number }>) {
  const labels = vitals.map((v) => new Date(v.date).toISOString().slice(5, 10));
  const pulse = vitals.map((v) => (typeof v.pulse === "number" ? v.pulse : null));
  const temp = vitals.map((v) => (typeof v.temp === "number" ? v.temp : null));
  if (!pulse.some((n) => n != null) && !temp.some((n) => n != null)) return undefined;

  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 260;
  // eslint-disable-next-line no-new
  new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Pulse (bpm)", data: pulse, borderColor: "#2563eb", fill: false, spanGaps: true, tension: 0.25 },
        { label: "Temp (°C)", data: temp, borderColor: "#ef4444", fill: false, spanGaps: true, tension: 0.25 },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      scales: { y: { beginAtZero: false } },
      plugins: { legend: { position: "bottom" } },
    },
  });
  return canvas.toDataURL("image/png");
}

// ---------------- core: jsPDF generator ----------------
export const generatePdfBlob = async (props: any): Promise<Blob> => {
  const {
    type, // 'rx' | 'sick' | 'fitness'
    patientName,
    patientId,
    clinicianName,
    clinicianReg,
    clinicName = CLINIC_NAME_DEFAULT,
    clinicLogoUrl = "/logo.png",
    clinicAddress = CLINIC_ADDRESS_DEFAULT,
    date = new Date().toISOString(),
    notes,
    plan,
    durationDays = 0,
    vitals = [], // [{date, bp, pulse, temp}]
    rxItems = [], // [{drug, dose, route, freq, duration, qty, notes}]
    labTests = [], // [{name, notes}]
  } = props;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageW - 48;

  // Header
  const logo = await fetchImageAsDataUrl(clinicLogoUrl);
  let y = 44;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", left, y, 50, 50);
    } catch {}
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(clinicName, left + (logo ? 58 : 0), y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(clinicAddress, left + (logo ? 58 : 0), y + 36);

  // Title badge
  const title =
    type === "rx"
      ? "Electronic Prescription (eRx)"
      : type === "sick"
      ? "Medical Sick Note"
      : "Fitness for Work Certificate";

  y = 118;
  if (type === "rx") {
    // Futuristic badge
    doc.setDrawColor(90, 130, 255);
    doc.setFillColor(242, 247, 255);
    doc.roundedRect(left, y - 24, 220, 26, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(45, 70, 160);
    doc.text("eRx • Electronic Prescription", left + 12, y - 6);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, left, (y += 22));
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, left, y);
  }

  // Patient/Clinician block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const infoTop = y + 14;
  const colMid = left + (pageW - 2 * left) / 2;

  doc.text(`Patient: ${patientName || "—"}${patientId ? `  /  ${patientId}` : ""}`, left, infoTop);
  doc.text(`Date: ${prettyDate(date)}`, left, infoTop + 16);
  doc.text(`Clinician: ${clinicianName || "—"}${clinicianReg ? ` (Reg: ${clinicianReg})` : ""}`, left, infoTop + 32);

  // dividing rule
  let cursorY = infoTop + 44;
  doc.setDrawColor(230, 230, 230);
  doc.line(left, cursorY, right, cursorY);
  cursorY += 16;

  // --- Document bodies ---
  if (type === "sick") {
    doc.setFont("helvetica", "bold");
    doc.text("Certification", left, cursorY);
    cursorY += 16;
    doc.setFont("helvetica", "normal");
    const t = `This is to certify that ${patientName || "the patient"} presented for consultation and is medically unfit for work for a period of ${durationDays} day${durationDays === 1 ? "" : "s"}.`;
    const wrap = doc.splitTextToSize(t, right - left);
    doc.text(wrap, left, cursorY);
    cursorY += 14 * wrap.length + 10;

    if (plan) {
      doc.setFont("helvetica", "bold");
      doc.text("Plan / Recommendations", left, cursorY);
      cursorY += 14;
      doc.setFont("helvetica", "normal");
      const s = doc.splitTextToSize(plan, right - left);
      doc.text(s, left, cursorY);
      cursorY += 14 * s.length + 10;
    }
    if (notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Additional Notes", left, cursorY);
      cursorY += 14;
      doc.setFont("helvetica", "normal");
      const s = doc.splitTextToSize(notes, right - left);
      doc.text(s, left, cursorY);
      cursorY += 14 * s.length + 10;
    }
  }

  if (type === "fitness") {
    if (vitals?.length) {
      doc.setFont("helvetica", "bold");
      doc.text("Recent Vitals", left, cursorY);
      cursorY += 8;
      autoTable(doc, {
        startY: cursorY + 4,
        head: [["Date", "BP", "Pulse", "Temp"]],
        body: vitalsRows(vitals),
        styles: { fontSize: 9 },
        margin: { left },
        tableWidth: right - left,
      });
      cursorY = (doc as any).lastAutoTable?.finalY ?? cursorY + 64;

      const img = await tinyVitalsChartImage(vitals);
      if (img) {
        doc.addImage(img, "PNG", left, cursorY + 10, right - left, 140);
        cursorY += 160;
      }
      cursorY += 6;
    }

    if (plan) {
      doc.setFont("helvetica", "bold");
      doc.text("Plan / Recommendations", left, cursorY);
      cursorY += 14;
      doc.setFont("helvetica", "normal");
      const s = doc.splitTextToSize(plan, right - left);
      doc.text(s, left, cursorY);
      cursorY += 14 * s.length + 10;
    }
    if (notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Additional Notes", left, cursorY);
      cursorY += 14;
      doc.setFont("helvetica", "normal");
      const s = doc.splitTextToSize(notes, right - left);
      doc.text(s, left, cursorY);
      cursorY += 14 * s.length + 10;
    }
  }

  if (type === "rx") {
    // Rx main table
    doc.setFont("helvetica", "bold");
    doc.text("Prescribed Medication", left, cursorY);
    cursorY += 6;

    const rows =
      Array.isArray(rxItems) && rxItems.length
        ? rxItems.map((r: any) => [
            r.drug || "—",
            r.dose || "—",
            r.route || "—",
            r.freq || "—",
            r.duration || "—",
            r.qty || "—",
          ])
        : [["—", "—", "—", "—", "—", "—"]];

    autoTable(doc, {
      startY: cursorY + 6,
      head: [["Drug", "Dose", "Route", "Freq.", "Duration", "Qty"]],
      body: rows,
      styles: { fontSize: 9 },
      margin: { left },
      tableWidth: right - left,
      columnStyles: { 0: { cellWidth: 200 } },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });
    cursorY = (doc as any).lastAutoTable?.finalY ?? cursorY + 70;

    // Lab tests (new)
    if (Array.isArray(labTests) && labTests.length) {
      cursorY += 14;
      doc.setFont("helvetica", "bold");
      doc.text("Requested Lab Tests", left, cursorY);
      cursorY += 6;

      autoTable(doc, {
        startY: cursorY + 6,
        head: [["Test", "Notes"]],
        body: labTests.map((t: any) => [t.name || "—", t.notes || ""]),
        styles: { fontSize: 9 },
        margin: { left },
        tableWidth: right - left,
        headStyles: { fillColor: [16, 185, 129], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 255, 248] },
      });
      cursorY = (doc as any).lastAutoTable?.finalY ?? cursorY + 50;
    }

    // Optional notes
    const noteLines: string[] = [];
    (rxItems || []).forEach((r: any) => {
      if (r?.notes) noteLines.push(`• ${r.drug}: ${r.notes}`);
    });
    if (noteLines.length || notes) {
      cursorY += 12;
      doc.setFont("helvetica", "bold");
      doc.text("Notes", left, cursorY);
      cursorY += 14;
      doc.setFont("helvetica", "normal");
      const s = doc.splitTextToSize([noteLines.join("\n"), notes].filter(Boolean).join("\n"), right - left);
      doc.text(s, left, cursorY);
      cursorY += 14 * s.length + 10;
    }
  }

  // Signature near bottom (push down if plenty of space)
  const sigBlockH = 70;
  if (cursorY < pageH - sigBlockH - 90) cursorY = pageH - sigBlockH - 90;

  cursorY += 18;
  doc.setDrawColor(200, 200, 200);
  doc.line(left, cursorY, left + 260, cursorY);
  cursorY += 14;
  doc.setFont("helvetica", "normal");
  doc.text(clinicianName || "—", left, cursorY);
  cursorY += 12;
  if (clinicianReg) doc.text(`Reg No: ${clinicianReg}`, left, cursorY);

  // Footer (exact spec)
  const footerY = pageH - 24;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(FOOTER_TEXT(patientName), left, footerY);

  return doc.output("blob");
};

// ---------------- Main component UI ----------------
export default function MedicalDocs(props: MedicalDocProps) {
  const {
    encounterId,
    clinicianName,
    clinicianReg,
    clinicName = CLINIC_NAME_DEFAULT,
    clinicLogoUrl = "/logo.png",
    clinicAddress = CLINIC_ADDRESS_DEFAULT,
    patientId,
    patientName,
    patientHasIoMT = false,
    initialSessionVitals = [],
    onGenerated,
    uploadEndpoint = "/api/MedicalDocs",
    hideErx = false,
    defaultNoteType = "none",
  } = props;

  const clinicianDisplay = clinicianName || "Dr. Heather van Leroy (mock)";
  const clinicianRegDisplay = clinicianReg || "REG-MP3920212";

  const [noteType, setNoteType] = useState<"none" | "sick" | "fitness" | "rx">(defaultNoteType);
  const [plan, setPlan] = useState("");
  const [notes, setNotes] = useState("");
  const [durationDays, setDurationDays] = useState<number>(1);

  // eRx inputs
  const [rxItems, setRxItems] = useState<any[]>([]);
  const [labTestsText, setLabTestsText] = useState(""); // one test per line

  const [sessionVitals, setSessionVitals] = useState<Vitals[]>(initialSessionVitals || []);
  const [historicVitals, setHistoricVitals] = useState<Vitals[]>([]);
  const [iomtVitals, setIomtVitals] = useState<Vitals[]>([]);

  const [includeSessionVitals, setIncludeSessionVitals] = useState(true);
  const [includeHistoricVitals, setIncludeHistoricVitals] = useState(false);
  const [includeIoMTVitals, setIncludeIoMTVitals] = useState(patientHasIoMT);

  const [includeHR, setIncludeHR] = useState(true);
  const [includeSpO2, setIncludeSpO2] = useState(true);
  const [includeTemp, setIncludeTemp] = useState(true);
  const [includeBP, setIncludeBP] = useState(true);

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfScale, setPdfScale] = useState<number>(1.0);
  const [loading, setLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const chartRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    async function loadHistoric() {
      try {
        const res = await fetch("/api/reports/vitals", { cache: "no-store" });
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (!mounted) return;
        const normalized: Vitals[] = Array.isArray(data)
          ? data.map((r: any) => normalizeVitals(r))
          : (data.trend || []).map((r: any) => normalizeVitals(r));
        setHistoricVitals(normalized);
      } catch {
        setHistoricVitals([]);
      }
    }
    loadHistoric();
    const interval = setInterval(loadHistoric, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!patientHasIoMT || !encounterId) return;
    let mounted = true;
    let poll: number | undefined;
    async function fetchIoMT() {
      try {
        const res = await fetch(`/api/iomt/encounter/${encounterId}/vitals`, { cache: "no-store" });
        if (!res.ok) throw new Error("no iomt");
        const data = await res.json();
        if (!mounted) return;
        const normalized = Array.isArray(data) ? data.map((r: any) => normalizeVitals(r)) : [];
        setIomtVitals((prev) => {
          const all = [...prev, ...normalized];
          const uniq = Object.values(
            all.reduce((acc: any, v: Vitals) => {
              const key = String(v.ts || Math.random());
              acc[key] = v;
              return acc;
            }, {} as Record<string, Vitals>)
          );
          return (uniq as Vitals[]).slice(-200);
        });
      } catch {
        // silent
      } finally {
        poll = window.setTimeout(fetchIoMT, 6000);
      }
    }
    fetchIoMT();
    return () => {
      mounted = false;
      if (poll) clearTimeout(poll);
    };
  }, [patientHasIoMT, encounterId]);

  function addManualVitalRow() {
    setSessionVitals((s) => [
      ...s,
      { ts: Date.now(), hr: undefined, spo2: undefined, tempC: undefined, sys: undefined, dia: undefined },
    ]);
  }
  function updateSessionVital(idx: number, patch: Partial<Vitals>) {
    setSessionVitals((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeSessionVital(idx: number) {
    setSessionVitals((s) => s.filter((_, i) => i !== idx));
  }

  // On-screen chart
  function buildChartData() {
    const combined: Vitals[] = [
      ...(includeHistoricVitals ? historicVitals : []),
      ...(includeIoMTVitals ? iomtVitals : []),
      ...(includeSessionVitals ? sessionVitals : []),
    ];
    const sorted = [...combined].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const labels = sorted.map((v) => (v.ts ? new Date(v.ts).toLocaleTimeString() : ""));
    const hrData = sorted.map((v) => v.hr ?? null);
    const spo2Data = sorted.map((v) => v.spo2 ?? null);
    const tempData = sorted.map((v) => v.tempC ?? null);
    const sysData = sorted.map((v) => v.sys ?? null);
    const diaData = sorted.map((v) => v.dia ?? null);

    const datasets: any[] = [];
    if (includeHR) datasets.push({ label: "HR", data: hrData, tension: 0.3, borderColor: "#ef4444", spanGaps: true });
    if (includeSpO2) datasets.push({ label: "SpO₂", data: spo2Data, tension: 0.3, borderColor: "#22c55e", spanGaps: true });
    if (includeTemp) datasets.push({ label: "Temp", data: tempData, tension: 0.3, borderColor: "#3b82f6", spanGaps: true });
    if (includeBP) {
      datasets.push({ label: "Sys", data: sysData, tension: 0.3, borderColor: "#f97316", spanGaps: true });
      datasets.push({ label: "Dia", data: diaData, tension: 0.3, borderColor: "#eab308", spanGaps: true });
    }
    return { labels, datasets };
  }

  const chartData = buildChartData();
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top" as const } },
    scales: { x: { display: true }, y: { display: true } },
  };

  // Compose vitals for PDF
  function composeVitalsForPdf() {
    const combined: Vitals[] = [
      ...(includeHistoricVitals ? historicVitals : []),
      ...(includeIoMTVitals ? iomtVitals : []),
      ...(includeSessionVitals ? sessionVitals : []),
    ];
    return combined
      .map((v) => ({
        date: v.ts ? new Date(v.ts).toISOString() : new Date().toISOString(),
        bp: v.sys && v.dia ? `${v.sys}/${v.dia}` : undefined,
        pulse: v.hr ?? undefined,
        temp: v.tempC ?? undefined,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Build lab tests array from textarea (one per line; optional " - notes")
  function parseLabTests() {
    return labTestsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, ...rest] = line.split(" - ");
        return { name, notes: rest.join(" - ") || "" };
      });
  }

  async function buildPdfBlob(): Promise<Blob> {
    const docProps = {
      type: (noteType === "sick" ? "sick" : noteType === "fitness" ? "fitness" : noteType === "rx" ? "rx" : "fitness") as DocType,
      patientName,
      patientId,
      clinicianName: clinicianDisplay,
      clinicianReg: clinicianRegDisplay,
      clinicName,
      clinicLogoUrl,
      clinicAddress,
      date: new Date().toISOString(),
      notes,
      plan,
      durationDays,
      vitals: composeVitalsForPdf(),
      rxItems,
      labTests: parseLabTests(),
    };
    return generatePdfBlob(docProps);
  }

  // helper to POST to encounter docs endpoint
  async function registerEncounterDoc(blob: Blob, filename: string): Promise<any | null> {
    if (!encounterId) return null;
    try {
      const form = new FormData();
      form.append("file", new File([blob], filename, { type: "application/pdf" }));
      if (patientId) form.append("patientId", String(patientId));
      form.append("docType", noteType === "rx" ? "erx" : noteType === "sick" ? "sick-note" : "fitness-note");
      form.append("title", filename);
      form.append("source", "clinician-app");
      const res = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/docs`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        console.warn("registerEncounterDoc failed", res.status);
        return null;
      }
      const js = await res.json().catch(() => null);
      return js;
    } catch (err) {
      console.warn("registerEncounterDoc error", err);
      return null;
    }
  }

  // ACTIONS
  async function handlePreview() {
    setPdfError(null);
    setLoading(true);
    try {
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(url);
      setTimeout(() => {
        const el = document.getElementById("medical-docs-pdf-viewer");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (e: any) {
      console.error("Preview failed", e);
      setPdfError(String(e?.message || e));
      alert(`Failed to generate PDF preview.\n\nError: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setLoading(true);
    try {
      const blob = await buildPdfBlob();
      const filename = `${(patientName || "patient").replace(/\s+/g, "_")}-${noteType || "note"}-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-")}.pdf`;

      // First try to register against encounter-docs endpoint
      const serverDoc = await registerEncounterDoc(blob, filename);

      // Then trigger client download (always)
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      onGenerated?.({ filename, size: blob.size, serverDoc });
    } catch (e) {
      console.error("Download failed", e);
      alert("Download failed — check console.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAttachToPatient() {
    if (!patientId) {
      alert("Please open this patient’s record first to attach the PDF.");
      return;
    }
    setLoading(true);
    try {
      const blob = await buildPdfBlob();
      const filename = `${(patientName || "patient").replace(/\s+/g, "_")}-${noteType || "note"}-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-")}.pdf`;

      let serverDoc: any | null = null;

      // Preferred path: encounter docs endpoint (aligned with encounters-docs.yaml)
      if (encounterId) {
        serverDoc = await registerEncounterDoc(blob, filename);
      }

      // Back-compat fallback to legacy uploadEndpoint if encounter-docs not available
      if (!serverDoc) {
        const form = new FormData();
        form.append("file", new File([blob], filename, { type: "application/pdf" }));
        form.append("patientId", String(patientId ?? ""));
        form.append("encounterId", String(encounterId ?? ""));
        form.append("type", String(noteType));

        const res = await fetch(uploadEndpoint, { method: "POST", body: form });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error("Attach upload failed", res.status, txt);
          alert(`Attach failed: ${res.status} ${res.statusText}`);
          setLoading(false);
          return;
        }
        serverDoc = await res.json().catch(() => ({}));
      }

      alert("Document attached and sent to patient.");
      onGenerated?.({ filename, size: blob.size, serverDoc });
    } catch (e) {
      console.error("Attach failed", e);
      alert("Attach failed — check console.");
    } finally {
      setLoading(false);
    }
  }

  // viewer controls
  const zoomIn = () => setPdfScale((s) => Math.min(3, +(s + 0.2).toFixed(2)));
  const zoomOut = () => setPdfScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)));
  function clearPreview() {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setPdfError(null);
  }

  useEffect(
    () => () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    },
    [pdfBlobUrl]
  );

  // ------- UI -------
  const docTypeOptions = [
    { value: "none", label: "Clinical Note" },
    { value: "sick", label: "Sick Note" },
    { value: "fitness", label: "Fitness Certificate" },
    ...(hideErx ? [] : [{ value: "rx", label: "Prescription (eRx)" }]),
  ] as const;

  return (
    <div className="p-4 space-y-4 bg-white rounded shadow-sm">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          {clinicLogoUrl && (
            <img
              src={clinicLogoUrl}
              alt="Clinic logo"
              className="h-10 w-10 rounded border border-slate-200 object-contain bg-white"
            />
          )}
          <div>
            <h3 className="text-lg font-semibold">Medical Document</h3>
            <div className="text-sm text-slate-600">{clinicName}</div>
          </div>
        </div>
        <div className="text-sm text-slate-700 text-right">
          <div>
            Clinician: <span className="font-medium">{clinicianDisplay}</span>
          </div>
          <div>
            Practice No: <span className="font-medium">{clinicianRegDisplay}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <label className="block text-sm">
            Document Type
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as any)}
              className="block w-full border rounded p-2 mt-1"
            >
              {docTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {noteType !== "rx" && (
            <>
              <label className="block text-sm">
                Plan / Recommendations
                <textarea
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border rounded p-2"
                />
              </label>

              <label className="block text-sm">
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="mt-1 w-full border rounded p-2"
                />
              </label>

              {noteType === "sick" && (
                <label className="block text-sm">
                  Duration (days)
                  <input
                    type="number"
                    min={1}
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value) || 1)}
                    className="mt-1 w-40 border rounded p-2"
                  />
                </label>
              )}
            </>
          )}

          {noteType === "rx" && (
            <div className="space-y-3">
              <div className="text-sm font-medium">Prescription Items</div>
              <RxEditor items={rxItems} setItems={setRxItems} />
              <label className="block text-sm">
                Lab Tests (one per line, optional “ - notes”)
                <textarea
                  value={labTestsText}
                  onChange={(e) => setLabTestsText(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border rounded p-2"
                  placeholder={`CRP - urgent\nFBC\nU&E - add eGFR`}
                />
              </label>
              <label className="block text-sm">
                General Notes (optional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border rounded p-2"
                />
              </label>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Include in Report</div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeSessionVitals}
              onChange={(e) => setIncludeSessionVitals(e.target.checked)}
            />{" "}
            This session vitals
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeIoMTVitals}
              onChange={(e) => setIncludeIoMTVitals(e.target.checked)}
            />{" "}
            IoMT feed
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeHistoricVitals}
              onChange={(e) => setIncludeHistoricVitals(e.target.checked)}
            />{" "}
            Historic vitals
          </label>

          <div className="text-sm font-medium mt-2">Metrics</div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeHR} onChange={(e) => setIncludeHR(e.target.checked)} /> HR
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeSpO2} onChange={(e) => setIncludeSpO2(e.target.checked)} /> SpO₂
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeTemp} onChange={(e) => setIncludeTemp(e.target.checked)} /> Temp
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeBP} onChange={(e) => setIncludeBP(e.target.checked)} /> BP
          </label>
        </div>
      </div>

      {/* Manual vitals input (for notes & fitness) */}
      {noteType !== "rx" && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Session Vitals (Manual)</h4>
            <div>
              <button
                type="button"
                onClick={addManualVitalRow}
                className="px-3 py-1 border rounded"
              >
                Add row
              </button>
            </div>
          </div>

          {sessionVitals.length === 0 ? (
            <div className="text-sm text-slate-500">
              No session vitals yet — add a row or enable IoMT.
            </div>
          ) : (
            <div className="space-y-2">
              {sessionVitals.map((r, idx) => (
                <div key={idx} className="grid grid-cols-6 gap-2 items-center">
                  <input
                    type="datetime-local"
                    value={r.ts ? new Date(r.ts).toISOString().slice(0, 16) : ""}
                    onChange={(e) =>
                      updateSessionVital(idx, {
                        ts: e.target.value ? new Date(e.target.value).getTime() : undefined,
                      })
                    }
                    className="col-span-2 border rounded p-1"
                  />
                  <input
                    placeholder="HR"
                    value={r.hr ?? ""}
                    onChange={(e) =>
                      updateSessionVital(idx, {
                        hr: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="border rounded p-1"
                  />
                  <input
                    placeholder="SpO₂"
                    value={r.spo2 ?? ""}
                    onChange={(e) =>
                      updateSessionVital(idx, {
                        spo2: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="border rounded p-1"
                  />
                  <input
                    placeholder="Temp (°C)"
                    value={r.tempC ?? ""}
                    onChange={(e) =>
                      updateSessionVital(idx, {
                        tempC: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="border rounded p-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeSessionVital(idx)}
                    className="px-2 py-1 text-sm text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* UI Chart */}
      <div
        id="medical-docs-chart-wrap"
        style={{ height: 260 }}
        className="border rounded p-2"
      >
        <Line ref={chartRef} data={chartData as any} options={chartOptions as any} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          className="px-4 py-2 bg-gray-600 text-white rounded"
          disabled={loading}
        >
          Preview
        </button>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-blue-600 text-white rounded"
          disabled={loading}
        >
          Download PDF
        </button>
        <button
          onClick={handleAttachToPatient}
          className="px-4 py-2 bg-green-600 text-white rounded"
          disabled={loading}
        >
          Attach to Patient
        </button>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(JSON.stringify({ plan, notes }));
            alert("Copied content");
          }}
          className="px-4 py-2 border rounded"
        >
          Copy plan/notes
        </button>
      </div>

      {/* PDF viewer (iframe) */}
      <div id="medical-docs-pdf-viewer" className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">PDF Preview</div>
          <div className="flex items-center gap-2">
            <button onClick={zoomOut} className="px-2 py-1 border rounded">
              -
            </button>
            <div className="px-2">{(pdfScale * 100).toFixed(0)}%</div>
            <button onClick={zoomIn} className="px-2 py-1 border rounded">
              +
            </button>
            <button
              onClick={() => {
                if (pdfBlobUrl) window.open(pdfBlobUrl, "_blank");
              }}
              className="px-3 py-1 border rounded"
            >
              Open
            </button>
            <button
              onClick={clearPreview}
              className="px-3 py-1 bg-red-600 text-white rounded"
            >
              Clear
            </button>
          </div>
        </div>

        {pdfError ? <div className="text-red-600">{pdfError}</div> : null}

        <div style={{ minHeight: 200, border: "1px solid #e5e7eb", padding: 8 }}>
          {pdfBlobUrl ? (
            <div style={{ width: "100%", height: "600px", overflow: "auto" }}>
              <iframe
                title="PDF preview"
                src={pdfBlobUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  transform: `scale(${pdfScale})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              No preview generated yet — click Preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small inline editor for eRx items */
function RxEditor({ items, setItems }: { items: any[]; setItems: (v: any[]) => void }) {
  function add() {
    setItems([
      ...items,
      { drug: "", dose: "", route: "", freq: "", duration: "", qty: "", notes: "" },
    ]);
  }
  function upd(i: number, patch: any) {
    setItems(items.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function rm(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="text-sm">Items</div>
        <button
          type="button"
          onClick={add}
          className="px-2 py-1 border rounded text-sm"
        >
          Add
        </button>
      </div>
      {items.length === 0 && (
        <div className="text-xs text-slate-500">No items — click Add.</div>
      )}
      {items.map((r, i) => (
        <div key={i} className="grid grid-cols-6 gap-2">
          <input
            placeholder="Drug"
            value={r.drug}
            onChange={(e) => upd(i, { drug: e.target.value })}
            className="border rounded p-1 col-span-2"
          />
          <input
            placeholder="Dose"
            value={r.dose}
            onChange={(e) => upd(i, { dose: e.target.value })}
            className="border rounded p-1"
          />
          <input
            placeholder="Route"
            value={r.route}
            onChange={(e) => upd(i, { route: e.target.value })}
            className="border rounded p-1"
          />
          <input
            placeholder="Freq."
            value={r.freq}
            onChange={(e) => upd(i, { freq: e.target.value })}
            className="border rounded p-1"
          />
          <input
            placeholder="Duration"
            value={r.duration}
            onChange={(e) => upd(i, { duration: e.target.value })}
            className="border rounded p-1"
          />
          <input
            placeholder="Qty"
            value={r.qty}
            onChange={(e) => upd(i, { qty: e.target.value })}
            className="border rounded p-1"
          />
          <input
            placeholder="Item notes (optional)"
            value={r.notes || ""}
            onChange={(e) => upd(i, { notes: e.target.value })}
            className="border rounded p-1 col-span-6"
          />
          <div className="col-span-6 flex justify-end">
            <button
              type="button"
              onClick={() => rm(i)}
              className="px-2 py-1 text-xs text-red-600"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
