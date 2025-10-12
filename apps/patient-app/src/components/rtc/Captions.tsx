"use client";
import { useEffect, useRef, useState } from "react";

export default function Captions({lang="en-UK"}:{lang?:string}){
  const [on, setOn] = useState(false);
  const [text, setText] = useState("");
  const recRef = useRef<any>(null);

  function start(){
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if(!SR){ alert("SpeechRecognition not supported"); return; }
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e:any)=>{
      let t = ""; for(let i=e.resultIndex;i<e.results.length;i++){ t += e.results[i][0].transcript + " "; }
      setText(t.trim());
    };
    rec.onerror = ()=>{};
    rec.onend = ()=> setOn(false);
    recRef.current = rec;
    rec.start(); setOn(true);
  }
  function stop(){ try{ recRef.current?.stop(); }catch{} setOn(false); }

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="text-sm font-medium">Live Captions</div>
      <div className="flex gap-2">
        {!on ? <button className="border rounded px-3 py-1" onClick={start}>Start</button>
             : <button className="border rounded px-3 py-1" onClick={stop}>Stop</button>}
        <span className="text-xs opacity-60">({lang})</span>
      </div>
      <div className="h-16 text-xs border rounded p-2 whitespace-pre-wrap">{text}</div>
    </div>
  );
}