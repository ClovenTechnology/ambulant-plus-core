"use client";
import React,{useEffect,useState} from "react";
type Task={id:string;completed:boolean};
export default function TasksNavBadge(){
  const [n,setN]=useState(0);
  async function load(){ try{ const r=await fetch("/api/tasks",{cache:"no-store"}); const d:Task[]=await r.json(); setN(d.filter(x=>!x.completed).length);}catch{} }
  useEffect(()=>{load(); const t=setInterval(load,20000); return()=>clearInterval(t);},[]);
  if(n<=0) return null;
  return <span className="ml-1 inline-flex items-center rounded-full bg-emerald-600 text-white text-[10px] font-medium px-1.5 py-0.5 leading-none">{n}</span>;
}
