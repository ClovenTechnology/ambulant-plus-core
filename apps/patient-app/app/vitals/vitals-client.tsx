"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Vital = {
  ts: string;             // ISO date
  hr?: number;            // bpm
  spo2?: number;          // %
  temp_c?: number;        // °C
  sys?: number; dia?: number; // BP
  bmi?: number;
  source?: "manual" | "iomt";
};

function Tile({
  label,
  value,
  unit,
  via,
}: { label: string; value?: string | number; unit?: string; via?: string }) {
  return (
    <div className="p-4 border rounded-lg bg-white">
      <div className="text-xs text-gray-500">
        {label}{" "}
        {via ? (
          <span className="text-[10px] text-gray-400"> via {via}</span>
        ) : null}
      </div>
      <div className="text-xl font-semibold">
        {value ?? "”"}
        {unit ? ` ${unit}` : ""}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </section>
  );
}

export default function VitalsClient({ initial = [] as Vital[] }) {
  const [items, setItems] = useState<Vital[]>(initial ?? []);
  const [pending, setPending] = useState(false);
  const [live, setLive] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Keep newest first
  const sorted = useMemo(
    () => (items ?? []).slice().sort((a, b) => (a.ts < b.ts ? 1 : -1)),
    [items]
  );
  const latest = sorted[0];

  // If initial was empty (or failed), try once on mount
  useEffect(() => {
    if ((initial ?? []).length === 0) {
      fetch("/api/vitals", { cache: "no-store" })
        .then((r) => r.json())
        .then((data: Vital[]) => setItems(data))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fmtDate(iso?: string) {
    if (!iso) return "”";
    const d = new Date(iso);
    return d.toLocaleString();
  }

  async function addReading() {
    setPending(true);
    try {
      // Generate a quick random-ish sample; feels alive during demo
      const jitter = (v: number, d = 2) =>
        Math.round((v + (Math.random() * d * 2 - d)) * 10) / 10;

      const payload: Partial<Vital> = {
        source: "manual",
        hr: Math.floor(jitter(76, 5)),
        spo2: Math.floor(jitter(98, 1)),
        temp_c: jitter(36.7, 0.2),
        sys: Math.floor(jitter(118, 6)),
        dia: Math.floor(jitter(76, 4)),
        bmi: 24.3,
      };

      const res = await fetch("/api/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const { item } = (await res.json()) as { item: Vital };
      setItems((prev) => [item, ...prev]);
    } catch (e) {
      // keep it quiet for demo; we could toast here
      console.error(e);
    } finally {
      setPending(false);
    }
  }

  function toggleLive() {
    if (!live) {
      const es = new EventSource("/api/iomt/stream");
      es.onmessage = (ev) => {
        try {
          const item = JSON.parse(ev.data) as Vital;
          setItems((prev) => [item, ...prev]);
        } catch {}
      };
      es.onerror = () => {
        es.close();
        setLive(false);
      };
      esRef.current = es;
      setLive(true);
    } else {
      esRef.current?.close();
      esRef.current = null;
      setLive(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vitals</h1>
        <div className="flex gap-2">
          <button
            onClick={toggleLive}
            className={`px-3 py-2 rounded-md border text-sm ${
              live ? "bg-green-50 border-green-300" : "bg-white"
            }`}
          >
            {live ? "Stop Live Stream" : "Start Live Stream"}
          </button>
          <button
            onClick={addReading}
            disabled={pending}
            className="px-3 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
          >
            {pending ? "Adding" : "Add Reading"}
          </button>
        </div>
      </header>

      {sorted.length === 0 ? (
        <div className="border rounded-lg p-6 text-center text-gray-600 bg-white">
          <div className="mb-2 font-medium">No vitals yet.</div>
          <div className="text-sm">
            Click <span className="font-semibold">Add Reading</span> or start the{" "}
            <span className="font-semibold">Live Stream</span> to simulate incoming IoMT data.
          </div>
        </div>
      ) : (
        <>
          <Section title={`Latest ${fmtDate(latest?.ts)}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Tile label="Heart Rate" value={latest?.hr} unit="bpm" via={latest?.source} />
              <Tile label="SpO2" value={latest?.spo2} unit="%" via={latest?.source} />
              <Tile label="Temperature" value={latest?.temp_c} unit="°C" via={latest?.source} />
              <Tile label="Systolic BP" value={latest?.sys} unit="mmHg" via={latest?.source} />
              <Tile label="Diastolic BP" value={latest?.dia} unit="mmHg" via={latest?.source} />
              <Tile label="BMI" value={latest?.bmi} via={latest?.source} />
            </div>
          </Section>

          <Section title="Recent History">
            <div className="overflow-auto border rounded-lg bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-600">
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">HR</th>
                    <th className="px-3 py-2 font-medium">SpO2</th>
                    <th className="px-3 py-2 font-medium">Temp(°C)</th>
                    <th className="px-3 py-2 font-medium">BP(mmHg)</th>
                    <th className="px-3 py-2 font-medium">BMI</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 8).map((v, i) => (
                    <tr key={v.ts + i} className="border-t">
                      <td className="px-3 py-2">{fmtDate(v.ts)}</td>
                      <td className="px-3 py-2">{v.hr ?? "”"}</td>
                      <td className="px-3 py-2">{v.spo2 ?? "”"}</td>
                      <td className="px-3 py-2">{v.temp_c ?? "”"}</td>
                      <td className="px-3 py-2">
                        {v.sys && v.dia ? `${v.sys}/${v.dia}` : "”"}
                      </td>
                      <td className="px-3 py-2">{v.bmi ?? "”"}</td>
                      <td className="px-3 py-2 uppercase text-xs text-gray-500">
                        {v.source ?? "”"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </main>
  );
}
