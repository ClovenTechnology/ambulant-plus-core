"use client";
import { useEffect, useState } from "react";

type Item = { id:string; patient:string; date:string; kind:"CarePort"|"MedReach"|"Generic"; total?:string };

export default function Outbox(){
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch("/api/erx/outbox", { cache:"no-store" });
        const j = r.ok ? await r.json() : [];
        setItems(Array.isArray(j)? j : []);
      }catch(e:any){
        setErr("Unable to load outbox (mock view shown).");
        setItems([
          { id:"RX-1001", patient:"Sibusiso Mthembu", date:new Date().toISOString().slice(0,10), kind:"CarePort", total:"R 180" },
        ]);
      }
    })();
  },[]);

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">eRx Outbox</h1>
      {err && <div className="text-xs text-red-600">{err}</div>}
      <table className="w-full text-sm border">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="py-2 px-2">ID</th>
            <th className="px-2">Patient</th>
            <th className="px-2">Date</th>
            <th className="px-2">Channel</th>
            <th className="px-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((x)=>(
            <tr key={x.id} className="border-t">
              <td className="py-2 px-2">{x.id}</td>
              <td className="px-2">{x.patient}</td>
              <td className="px-2">{x.date}</td>
              <td className="px-2">{x.kind}</td>
              <td className="px-2">{x.total||"—"}</td>
            </tr>
          ))}
          {items.length===0 && (
            <tr><td className="py-6 px-2 text-gray-500" colSpan={5}>No items yet.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}