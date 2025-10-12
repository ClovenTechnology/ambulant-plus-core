"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Kpi = { label:string; value:string|number; sub?:string };
const provinces = ["Gauteng","KZN","WC","EC","FS","MP","NW","NC","LP"];
const genders = ["All","Male","Female","Other"];

function mockKpis():Kpi[]{
  return [
    {label:"Total Revenue", value:"R 1,240,000", sub:"+12% MoM"},
    {label:"Patients", value: 18240, sub:"+4%"},
    {label:"Clinicians", value: 1260, sub:"A:420 • B:620 • C:220"},
    {label:"IoMT Devices", value: 9, sub:"Active: 7"},
    {label:"Rx Revenue", value:"R 310,500"},
    {label:"Total Payout", value:"R 870,000"},
    {label:"CarePort Revenue", value:"R 182,400", sub:"incl. riders"},

    {label:"MedReach Revenue", value:"R 226,900"},
    {label:"# Rider Payouts (CarePort)", value: 742},
    {label:"# Phleb Payouts (MedReach)", value: 311},
    {label:"Ambulant+ Earnings (net)", value:"R 344,800"},
    {label:"Total Refunds", value:"R 12,600"},
  ];
}

function drawChart(canvas:HTMLCanvasElement, data:number[]){
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = 260;
  ctx.clearRect(0,0,w,h);
  const pad = 32;
  const max = Math.max(...data, 1);
  const stepX = (w - pad*2) / (data.length-1);
  // axes
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();
  // line
  ctx.beginPath();
  data.forEach((v,i)=>{
    const x = pad + i*stepX;
    const y = h - pad - (v/max)*(h-pad*2);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.strokeStyle = "#111827"; ctx.lineWidth = 2; ctx.stroke();
}

export default function Analytics(){
  const [prov, setProv] = useState("Gauteng");
  const [city, setCity] = useState("All");
  const [gender, setGender] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const data = useMemo(()=> Array.from({length:12},(_,i)=> Math.round(50+Math.sin(i/2)*30 + Math.random()*20 )),[prov,city,gender,from,to]);

  useEffect(()=>{
    if(canvasRef.current) drawChart(canvasRef.current, data);
  },[data]);

  const kpis = mockKpis();

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-3">
        {kpis.map((k,i)=>(
          <div key={i} className="rounded-2xl border p-4 bg-white shadow-sm">
            <div className="text-xs text-gray-500">{k.label}</div>
            <div className="text-2xl font-semibold">{k.value}</div>
            {k.sub && <div className="text-xs text-gray-400 mt-1">{k.sub}</div>}
          </div>
        ))}
      </section>

      <section className="rounded-2xl border p-4 bg-white shadow-sm space-y-4">
        <div className="grid sm:grid-cols-5 gap-3">
          <select className="border rounded px-2 py-1" value={prov} onChange={e=>setProv(e.target.value)}>
            {provinces.map(p=><option key={p}>{p}</option>)}
          </select>
          <input className="border rounded px-2 py-1" placeholder="City/Town (All)" value={city} onChange={e=>setCity(e.target.value)} />
          <select className="border rounded px-2 py-1" value={gender} onChange={e=>setGender(e.target.value)}>
            {genders.map(g=><option key={g}>{g}</option>)}
          </select>
          <input type="date" className="border rounded px-2 py-1" value={from} onChange={e=>setFrom(e.target.value)} />
          <input type="date" className="border rounded px-2 py-1" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <div className="w-full"><canvas ref={canvasRef} className="w-full" /></div>
      </section>
    </main>
  );
}