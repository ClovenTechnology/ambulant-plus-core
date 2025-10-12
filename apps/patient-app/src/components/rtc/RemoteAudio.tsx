"use client";
import React, { useEffect, useRef } from "react";

export default function RemoteAudio({
  stream,
  sinkId
}:{
  stream: MediaStream|null;
  sinkId?: string|null;
}){
  const ref = useRef<HTMLAudioElement|null>(null);

  useEffect(()=>{
    if(ref.current){
      ref.current.srcObject = stream ?? null;
      // attempt play to satisfy autoplay policies
      ref.current.play?.().catch(()=>{ /* ignore */ });
    }
  }, [stream]);

  useEffect(()=>{
    const a = ref.current;
    if(!a) return;
    // @ts-ignore (setSinkId not in TS lib)
    if(sinkId && typeof (a as any).setSinkId === "function"){
      try { (a as any).setSinkId(sinkId); } catch {}
    }
  }, [sinkId]);

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}