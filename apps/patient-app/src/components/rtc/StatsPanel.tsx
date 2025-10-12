"use client";
import { useEffect, useState } from "react";

export default function StatsPanel({pc}:{pc: RTCPeerConnection|null}){
  const [s, setS] = useState<any>({});
  useEffect(()=>{
    if(!pc) return;
    let last = new Map<string, any>();
    let run = true;
    async function tick(){
      if(!run || !pc) return;
      try{
        const report = await pc.getStats();
        const cur = new Map<string, any>();
        let txBps = 0, rxBps = 0, jitter = 0, pl = 0, rtt = 0;

        report.forEach((r:any)=>{
          cur.set(r.id, r);
          const prev = last.get(r.id);
          if(r.type==="outbound-rtp" && r.kind==="video" && prev){
            const dt = (r.timestamp - prev.timestamp)/1000;
            if(dt>0) txBps += 8*(r.bytesSent - (prev.bytesSent||0))/dt;
          }
          if(r.type==="inbound-rtp" && r.kind==="video" && prev){
            const dt = (r.timestamp - prev.timestamp)/1000;
            if(dt>0) rxBps += 8*(r.bytesReceived - (prev.bytesReceived||0))/dt;
            pl += (r.packetsLost||0);
            jitter = Math.max(jitter, r.jitter||0);
          }
          if(r.type==="remote-inbound-rtp" && r.roundTripTime) rtt = Math.max(rtt, r.roundTripTime);
        });

        setS({
          conn: pc.connectionState,
          ice: pc.iceConnectionState,
          txKbps: Math.round(txBps/1000),
          rxKbps: Math.round(rxBps/1000),
          jitter: +jitter.toFixed(3),
          pktLost: pl,
          rttMs: Math.round((rtt||0)*1000),
        });
        last = cur;
      }catch{}
      setTimeout(tick, 1000);
    }
    tick();
    return ()=>{ run = false; };
  }, [pc]);

  return (
    <div className="border rounded p-3 space-y-1 text-xs">
      <div className="text-sm font-medium">Network Stats</div>
      <div>Conn: {s.conn ?? "-"}</div>
      <div>ICE: {s.ice ?? "-"}</div>
      <div>Tx: {s.txKbps ?? 0} kbps</div>
      <div>Rx: {s.rxKbps ?? 0} kbps</div>
      <div>Jitter: {s.jitter ?? 0}s</div>
      <div>RTT: {s.rttMs ?? 0} ms</div>
      <div>Lost: {s.pktLost ?? 0}</div>
    </div>
  );
}