"use client";
import { useMemo, useState } from "react";
const pendingLabs = [{ test:"HbA1c", eta:"48h" }, { test:"CRP", eta:"6h" }];

export default function Reschedule(){
  const today = new Date().toISOString().slice(0,10);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");

  const etaSummary = useMemo(() => pendingLabs.map(l => `${l.test} (${l.eta})`).join(", "), []);

  function save(){
    if(date < today){ alert("No backdating allowed"); return; }
    alert(`Follow-up booked on ${date}. Notes: ${note}`);
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Book Follow‑up</h1>
      <div className="text-sm text-gray-600">Lab ETAs: {etaSummary||"—"}</div>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Date</div>
          <input type="date" className="border rounded px-2 py-1 w-full" min={today} value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-gray-500 mb-1">Notes (visible to patient)</div>
          <textarea className="border rounded px-2 py-1 w-full h-24" value={note} onChange={e=>setNote(e.target.value)} />
        </div>
      </div>
      <button className="border rounded px-3 py-1" onClick={save}>Confirm</button>
    </main>
  );
}