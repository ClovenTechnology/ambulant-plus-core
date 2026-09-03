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
const CLINIC_NAME_DEFAULT = "Ambulant+";
const CLINIC_ADDRESS_DEFAULT = "0B Meadowbrook Ln, Bryanston 2152, ZA";

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

// ---------------- core: governed server-side clinical document renderer ----------------
export const generatePdfBlob = async (props: any): Promise<Blob> => {
  const type = props?.type === 'sick' ? 'sick' : props?.type === 'fitness' ? 'fitness' : props?.type;
  if (type !== 'sick' && type !== 'fitness') {
    throw new Error('Use the encounter ePrescription workflow for medication prescriptions.');
  }
  const response = await fetch('/api/clinical-documents/render', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json', accept: 'application/pdf' },
    body: JSON.stringify({
      kind: type,
      encounterId: props?.encounterId,
      issuedAt: props?.date || new Date().toISOString(),
      patient: { id: props?.patientId, name: props?.patientName },
      clinician: { name: props?.clinicianName },
      durationDays: Number(props?.durationDays || 0),
      notes: props?.notes || '',
      plan: props?.plan || '',
      simulation: Boolean(props?.simulation),
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || 'Clinical document rendering failed.');
  }
  return await response.blob();
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
    if (noteType !== "sick" && noteType !== "fitness") {
      throw new Error("Select Sick Note or Fitness Certificate.");
    }
    const docProps = {
      type: (noteType === "sick" ? "sick" : noteType === "fitness" ? "fitness" : "none") as any,
      encounterId,
      patientId,
      patientName,
      clinicianName: clinicianDisplay,
      clinicianReg: clinicianRegDisplay,
      clinicName,
      clinicLogoUrl,
      clinicAddress,
      date: new Date().toISOString(),
      notes,
      plan,
      durationDays,
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
      form.append("docType", noteType === "sick" ? "sick-note" : "fitness-note");
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
    { value: "none", label: "Select document type" },
    { value: "sick", label: "Sick Note" },
    { value: "fitness", label: "Fitness Certificate" },
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

          {noteType === "rx" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Use the encounter ePrescription workflow for medication prescribing. This document panel creates sick notes and fitness certificates only.
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Encounter vitals reference</div>
          <div className="text-[11px] text-slate-500">Visible here for clinical context; routine vitals are not printed on the certificate.</div>
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
          disabled={loading || noteType === "none"}
        >
          Preview
        </button>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-blue-600 text-white rounded"
          disabled={loading || noteType === "none"}
        >
          Download PDF
        </button>
        <button
          onClick={handleAttachToPatient}
          className="px-4 py-2 bg-green-600 text-white rounded"
          disabled={loading || noteType === "none"}
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
