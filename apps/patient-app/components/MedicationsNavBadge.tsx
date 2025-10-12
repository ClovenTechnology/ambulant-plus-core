"use client";
import React,{useEffect,useState} from "react";
type Medication={status:"Active"|"Completed"|"On Hold"};
export default function MedicationsNavBadge(){
  const [n,setN]=useState(0);
  async function load(){ try{ const r=await fetch("/api/medications",{cache:"no-store"}); const d:Medication[]=await r.json(); setN(d.filter(x=>x.status==="Active").length);}catch{} }
  useEffect(()=>{load(); const t=setInterval(load,20000); return()=>clearInterval(t);},[]);
  if(n<=0) return null;
  return <span className="ml-1 inline-flex items-center rounded-full bg-sky-600 text-white text-[10px] font-medium px-1.5 py-0.5 leading-none">{n}</span>;
}
