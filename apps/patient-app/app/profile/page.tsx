"use client";
import { useEffect, useState } from "react";
export default function Profile(){
  const [h,setH]=useState<number>(175); const [w,setW]=useState<number>(75);
  useEffect(()=>{(async()=>{const j=await fetch("/api/profile",{cache:"no-store"}).then(r=>r.json()); setH(j.heightCm||175); setW(j.weightKg||75);})();},[]);
  async function save(){ await fetch("/api/profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({heightCm:h,weightKg:w})}); alert("Saved"); }
  const bmi = (w&&h)? (w/((h/100)**2)) : null;
  return (
    <main className="p-4 space-y-3">
      <h2 className="text-lg font-semibold">My Bio</h2>
      <div className="grid md:grid-cols-3 gap-3">
        <div><div className="text-sm text-gray-500">Height (cm)</div><input type="number" className="border rounded px-2 py-1 w-full" value={h} onChange={e=>setH(parseFloat(e.target.value))}/></div>
        <div><div className="text-sm text-gray-500">Weight (kg)</div><input type="number" className="border rounded px-2 py-1 w-full" value={w} onChange={e=>setW(parseFloat(e.target.value))}/></div>
        <div className="p-3 border rounded bg-white"><div className="text-sm text-gray-500">BMI</div><div className="text-2xl font-semibold">{bmi?bmi.toFixed(1):"â€”"}</div></div>
      </div>
      <button onClick={save} className="border rounded px-3 py-2">Save</button>
    </main>
  );
}
