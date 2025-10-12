"use client";
import { useEffect, useRef, useState } from "react";

type Cap = { ts:number; text:string; mine:boolean };

export default function CaptionsPanel({
  selfLabel, peerLabel
}:{
  selfLabel:string; peerLabel:string;
}){
  const [rows, setRows] = useState<Cap[]>([]);
  const listRef = useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    (window as any).__captionAdd = (c:Cap)=>{
      setRows(x=>{
        const next = [...x, c].slice(-500);
        queueMicrotask(()=>{
          const el = listRef.current;
          if(el) el.scrollTop = el.scrollHeight;
        });
        return next;
      });
    };
  },[]);

  function sep(){ return <span className="opacity-40 mx-1">-</span>; }

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="text-sm font-medium">Live Captions</div>
      <div ref={listRef} className="h-32 overflow-auto text-xs border rounded p-2 bg-white space-y-1">
        {rows.map((r,i)=>{
          const who = r.mine ? selfLabel : peerLabel;
          const t = new Date(r.ts).toLocaleTimeString();
          return (
            <div key={i}>
              <span className="opacity-60">{t}</span>{sep()}
              <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100">{who}</span>{sep()}
              <span>{r.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}