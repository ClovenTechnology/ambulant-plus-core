"use client";
import { useEffect, useState } from "react";
type Row={id:string;patient:string;status:string;createdAt?:string;
  phleb?:{name:string;phone:string;vehicle?:string};
  timeline:{t:string;label:string}[]};
export default function MedReachOrders(){
  const [rows,setRows]=useState<Row[]>([]);
  useEffect(()=>{(async()=>{const r=await fetch("/api/medreach/orders",{cache:"no-store"}); setRows(await r.json());})()},[]);
  return <main className="p-6 space-y-4">
    <h2 className="text-lg font-semibold">MedReach — Phlebotomist Timelines</h2>
    <div className="grid lg:grid-cols-2 gap-4">
      {rows.map(o=>(
        <div key={o.id} className="border rounded p-4 bg-white space-y-2">
          <div className="flex justify-between items-center">
            <div className="font-medium">{o.id} — {o.patient}</div>
            <div className="text-xs text-gray-500">{o.createdAt?.replace('T',' ').replace('Z','')||""}</div>
          </div>
          <div className="text-xs px-2 py-1 rounded bg-gray-100 w-fit uppercase">{o.status}</div>
          <div className="text-sm text-gray-700">
            <div className="font-medium mb-1">Phlebotomist</div>
            <div>{o.phleb?.name||"—"} · {o.phleb?.phone||"—"}</div>
          </div>
          <ol className="space-y-1 text-sm">
            {o.timeline?.map((s,i)=><li key={i} className="flex gap-2"><span className="w-12 text-gray-500">{s.t}</span><span>{s.label}</span></li>)}
          </ol>
        </div>
      ))}
    </div>
  </main>;
}