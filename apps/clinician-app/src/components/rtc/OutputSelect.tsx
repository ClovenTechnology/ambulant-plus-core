"use client";
import { useEffect, useState } from "react";

export default function OutputSelect({videoRef}:{videoRef: React.RefObject<HTMLVideoElement>}){
  const [outs, setOuts] = useState<{deviceId:string; label:string}[]>([]);
  const [id, setId] = useState<string>("");

  async function refresh(){
    try{
      const list = await navigator.mediaDevices.enumerateDevices();
      const speakers = list.filter(d=>d.kind==="audiooutput").map(d=>({deviceId:d.deviceId,label:d.label||"Speaker"}));
      setOuts(speakers);
    }catch(e){ console.error(e); }
  }
  useEffect(()=>{ refresh(); }, []);

  async function apply(v:string){
    setId(v);
    const el = videoRef.current;
    // @ts-ignore
    if(el && typeof el.setSinkId === "function"){
      try{ // @ts-ignore
        await el.setSinkId(v||"default");
      }catch(e){ console.error(e); }
    }
  }

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="text-sm font-medium">Audio Output</div>
      <select className="border rounded px-2 py-1 w-full" value={id} onChange={e=>apply(e.target.value)}>
        <option value="">System Default</option>
        {outs.map(o=> <option key={o.deviceId} value={o.deviceId}>{o.label}</option>)}
      </select>
      <button className="border rounded px-3 py-1" onClick={refresh}>Refresh outputs</button>
    </div>
  );
}