"use client";
import { useEffect, useState } from "react";

type Device = {
  id:string; vendor?:string; name:string; group?:string;
  active:boolean; mode:"mock"|"live"; streams:string[];
};

export default function SDKUpload(){
  const [list, setList] = useState<Device[]>([]);
  const [busy, setBusy] = useState<string>("");

  async function load(){
    const res = await fetch("/api/devices", { cache:"no-store" });
    const data = await res.json();
    setList(data||[]);
  }
  useEffect(()=>{ load(); },[]);

  async function callToggle(id:string, action:"toggleActive"|"toggleMode"){
    setBusy(id+action);
    try{
      const res = await fetch("/api/devices/toggle", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ id, action })
      });
      if(!res.ok) throw new Error("toggle fail");
      await load();
    }finally{ setBusy(""); }
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">IoMT SDK — Upload / Activation</h1>
      <p className="text-sm text-gray-600">Manage adapters. Toggle Mock/Live and Active status.</p>
      <div className="overflow-x-auto">
        <table className="min-w-[700px] w-full text-sm border">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="py-2 px-2">Name</th>
              <th className="px-2">Vendor</th>
              <th className="px-2">Group</th>
              <th className="px-2">Mode</th>
              <th className="px-2">Status</th>
              <th className="px-2">Streams</th>
              <th className="px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(d=>(
              <tr key={d.id} className="border-t">
                <td className="py-2 px-2">{d.name}</td>
                <td className="px-2">{d.vendor||"—"}</td>
                <td className="px-2">{d.group||"—"}</td>
                <td className="px-2 uppercase">{d.mode}</td>
                <td className="px-2">{d.active? "Active":"Inactive"}</td>
                <td className="px-2 truncate">{d.streams?.join(", ")}</td>
                <td className="px-2 space-x-2">
                  <button
                    className="border px-2 py-1 rounded"
                    disabled={busy.length>0}
                    onClick={()=>callToggle(d.id,"toggleMode")}>
                    {busy===d.id+"toggleMode" ? "…" : (d.mode==="mock"?"Switch to Live":"Switch to Mock")}
                  </button>
                  <button
                    className="border px-2 py-1 rounded"
                    disabled={busy.length>0}
                    onClick={()=>callToggle(d.id,"toggleActive")}>
                    {busy===d.id+"toggleActive" ? "…" : (d.active?"Deactivate":"Activate")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}