"use client";

export type SigMsg = { type:string; from?:string; to?:string; room?:string; data?:any; id?:string };

export function connectSignal(url:string, room:string, id:string, onMsg:(m:SigMsg)=>void){
  const ws = new WebSocket(`${url}?room=${encodeURIComponent(room)}&id=${encodeURIComponent(id)}`);
  ws.onopen  = () => { try { onMsg({ type: "_open"  }); } catch {} };
  ws.onclose = () => { try { onMsg({ type: "_close" }); } catch {} };
  ws.onerror = () => { try { onMsg({ type: "_error" }); } catch {} };
  ws.onmessage = (ev)=> { try{ onMsg(JSON.parse(ev.data)); }catch{} };
  return {
    ws,
    ready: ()=> ws.readyState === WebSocket.OPEN,
    send: (m:SigMsg)=> { if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({ ...m, room })); },
    close: ()=> ws.close()
  };
}