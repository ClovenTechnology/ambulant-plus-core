"use client";
import { useEffect, useState } from "react";

type Opt = { deviceId: string; label: string };

export default function DeviceSelect({
  audioId, videoId, onChange
}:{
  audioId?: string|null;
  videoId?: string|null;
  onChange: (d:{audioId:string|null; videoId:string|null})=>void;
}){
  const [mics, setMics] = useState<Opt[]>([]);
  const [cams, setCams] = useState<Opt[]>([]);
  const [a, setA] = useState<string|""|null>(audioId ?? "");
  const [v, setV] = useState<string|""|null>(videoId ?? "");

  async function loadDevices(){
    try{
      const list = await navigator.mediaDevices.enumerateDevices();
      const micOpts = list.filter(d=>d.kind==="audioinput").map(d=>({deviceId:d.deviceId, label:d.label||"Microphone"}));
      const camOpts = list.filter(d=>d.kind==="videoinput").map(d=>({deviceId:d.deviceId, label:d.label||"Camera"}));
      setMics(micOpts); setCams(camOpts);
    }catch(e){ console.error(e); }
  }

  useEffect(()=>{ loadDevices(); }, []);
  useEffect(()=>{ onChange({ audioId: a||null, videoId: v||null }); }, [a,v]);

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="text-sm opacity-70">Devices</div>

      <label className="block text-xs">Microphone</label>
      <select className="border rounded px-2 py-1 w-full"
        value={a ?? ""} onChange={e=>setA(e.target.value)}>
        <option value="">System Default</option>
        {mics.map(d=> <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
      </select>

      <label className="block text-xs mt-2">Camera</label>
      <select className="border rounded px-2 py-1 w-full"
        value={v ?? ""} onChange={e=>setV(e.target.value)}>
        <option value="">System Default</option>
        {cams.map(d=> <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
      </select>

      <button className="border rounded px-3 py-1 mt-2" onClick={loadDevices}>Refresh devices</button>
    </div>
  );
}