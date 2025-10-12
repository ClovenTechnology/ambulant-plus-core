"use client";
import { useEffect, useState } from "react";
type Perm = { view: boolean; download: boolean; print: boolean };
type PdfWatermark = { enabled: boolean; defaultText: string; careportText?: string; medreachText?: string };
type Settings = {
  reportAccessDays: number;
  reportPermissions: { premium: Perm; free: Perm };
  pdfWatermark: PdfWatermark;
  updatedAt?: string;
};
export default function GeneralSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  async function load(){
    setLoading(true);
    const res = await fetch("/api/settings/general", { cache:"no-store" });
    const data = await res.json();
    setS(data); setLoading(false);
  }
  useEffect(() => { load(); }, []);
  async function save(){
    setMsg("");
    const res = await fetch("/api/settings/general", {
      method:"POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(s)
    });
    if(res.ok){ setMsg("Saved."); await load(); } else { setMsg("Save failed."); }
  }
  if (loading || !s) return <main className="p-6">Loading…</main>;
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Settings — General</h1>
      {msg && <div className="text-sm text-green-600">{msg}</div>}
      <section className="p-4 border rounded bg-white space-y-3">
        <div className="font-medium">Report Access</div>
        <label className="flex items-center gap-2 text-sm">
          <span>Report Expiry (days):</span>
          <input type="number" className="border rounded px-2 py-1 w-24"
            value={s.reportAccessDays}
            onChange={e => setS({ ...s, reportAccessDays: parseInt(e.target.value||"0") })} />
        </label>
      </section>
      <section className="p-4 border rounded bg-white space-y-3">
        <div className="font-medium">Report Permissions</div>
        {(["premium","free"] as const).map(role => (
          <div key={role} className="flex items-center gap-3 text-sm">
            <div className="w-24 capitalize">{role}</div>
            {(["view","download","print"] as const).map(k => (
              <label key={k} className="flex items-center gap-1">
                <input type="checkbox"
                  checked={(s.reportPermissions[role] as any)[k]}
                  onChange={e => setS({
                    ...s,
                    reportPermissions: {
                      ...s.reportPermissions,
                      [role]: {
                        ...s.reportPermissions[role],
                        [k]: e.target.checked
                      }
                    }
                  })} />
                <span>{k}</span>
              </label>
            ))}
          </div>
        ))}
      </section>
      <section className="p-4 border rounded bg-white space-y-3">
        <div className="font-medium">PDF Watermark</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.pdfWatermark.enabled}
            onChange={e => setS({ ...s, pdfWatermark: { ...s.pdfWatermark, enabled: e.target.checked } })} />
          <span>Enable watermark</span>
        </label>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">Default Text
            <input className="border rounded px-2 py-1 w-full" value={s.pdfWatermark.defaultText}
              onChange={e => setS({ ...s, pdfWatermark: { ...s.pdfWatermark, defaultText: e.target.value } })} />
          </label>
          <label className="text-sm">CarePort Text
            <input className="border rounded px-2 py-1 w-full" value={s.pdfWatermark.careportText ?? ""}
              onChange={e => setS({ ...s, pdfWatermark: { ...s.pdfWatermark, careportText: e.target.value } })} />
          </label>
          <label className="text-sm">MedReach Text
            <input className="border rounded px-2 py-1 w-full" value={s.pdfWatermark.medreachText ?? ""}
              onChange={e => setS({ ...s, pdfWatermark: { ...s.pdfWatermark, medreachText: e.target.value } })} />
          </label>
        </div>
      </section>
      <div>
        <button className="px-3 py-2 border rounded" onClick={save}>Save</button>
      </div>
    </main>
  );
}
