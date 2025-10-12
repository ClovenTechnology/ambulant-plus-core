
"use client"
import { useState } from "react";

export default function Fees(){
  const [fee, setFee] = useState(550);
  const [followupFee, setFollowupFee] = useState(350);
  const [currency] = useState("ZAR");

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Consultation Fees</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Standard Fee ({currency})<input className="border rounded px-2 py-1 w-full" type="number" value={fee} onChange={e=>setFee(parseInt(e.target.value||'0'))}/></label>
        <label className="text-sm">Follow-up Fee ({currency})<input className="border rounded px-2 py-1 w-full" type="number" value={followupFee} onChange={e=>setFollowupFee(parseInt(e.target.value||'0'))}/></label>
      </div>
      <button className="px-3 py-2 border rounded">Save</button>
    </main>
  );
}
