
"use client"
import { useEffect, useState } from "react";

type Candidate = { id:string; label:string; reason:string };

export default function Pair(){
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<string|undefined>();

  useEffect(()=>{
    const ua = navigator.userAgent || "";
    const items: Candidate[] = [];
    if(/iPhone|iPad|iPod/.test(ua)){
      items.push({ id:"apple-watch", label:"Apple Watch (HealthKit)", reason:"iOS device detected" });
    }
    if(/Samsung|SM-|Galaxy/.test(ua)){
      items.push({ id:"samsung-galaxy-watch", label:"Galaxy Watch", reason:"Samsung device detected" });
      items.push({ id:"galaxy-ring", label:"Galaxy Ring", reason:"Samsung device detected" });
    }
    items.push({ id:"garmin-watch", label:"Garmin Watch", reason:"Popular brand" });
    items.push({ id:"fitbit-watch", label:"Fitbit Watch", reason:"Popular brand" });
    items.push({ id:"oura-ring", label:"Oura Ring", reason:"Popular ring" });
    setCandidates(items);
  },[]);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Pair a Device</h1>
      <div className="text-sm text-gray-600">We propose these based on your device. You can also pick manually.</div>
      <ul className="space-y-2">
        {candidates.map(c=> (
          <li key={c.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{c.label}</div>
              <div className="text-xs text-gray-500">{c.reason}</div>
            </div>
            <button className="px-3 py-2 border rounded" onClick={()=>setPicked(c.id)}>Select</button>
          </li>
        ))}
      </ul>
      {picked && <div className="p-3 bg-green-50 border rounded text-green-700 text-sm">Selected: {picked}</div>}
    </main>
  );
}
