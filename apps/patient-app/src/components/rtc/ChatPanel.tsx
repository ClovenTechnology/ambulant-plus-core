"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { id:string; text:string; ts:number; mine?:boolean };

export default function ChatPanel({
  send, onTyping, selfLabel, peerLabel
}:{
  send:(t:string)=>void;
  onTyping:(is:boolean)=>void;
  selfLabel:string;
  peerLabel:string;
}){
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [val, setVal] = useState("");
  const typingTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const listRef = useRef<HTMLDivElement|null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(()=>{
    (window as any).__chatAdd = (m:Msg)=>{
      setMsgs(x=>{
        const next = [...x, m];
        const el = listRef.current;
        const atBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight) < 8 : true;
        if(!atBottom) setUnread(u => u + 1);
        queueMicrotask(()=>{
          const el2 = listRef.current;
          if(el2 && atBottom){ el2.scrollTop = el2.scrollHeight; }
        });
        return next;
      });
    };
  },[]);

  function markReadIfAtBottom(){
    const el = listRef.current;
    if(!el) return;
    const atBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 8;
    if(atBottom && unread>0) setUnread(0);
  }
  function onScroll(){ markReadIfAtBottom(); }

  function sendNow(){
    const t = val.trim(); if(!t) return;
    const m:Msg = { id: "me", text:t, ts: Date.now(), mine:true };
    const el = listRef.current;
    const atBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight) < 8 : true;
    setMsgs(x=>{
      const next = [...x, m];
      queueMicrotask(()=>{
        const el2 = listRef.current;
        if(el2 && atBottom) el2.scrollTop = el2.scrollHeight;
      });
      return next;
    });
    send(t);
    setVal("");
    onTyping(false);
  }

  function onInput(v:string){
    setVal(v);
    onTyping(true);
    if(typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(()=> onTyping(false), 1200);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>){
    if(e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      sendNow();
    }
  }

  const [peerTyping, setPeerTyping] = useState(false);

  
  // SSR-safe bridge for typing indicator
  useEffect(()=>{
    if (typeof window !== 'undefined') {
      (window as any).__peerTyping = (flag:boolean)=> setPeerTyping(flag);
      return ()=>{ try{ delete (window as any).__peerTyping }catch{} };
    }
  },[]);function sep(){ return <span className="opacity-40 mx-1">-</span>; }

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Chat</div>
        {unread>0 && <div className="text-[11px] px-2 py-0.5 rounded-full bg-black text-white">{unread} new</div>}
      </div>
      <div ref={listRef} onScroll={onScroll} className="h-40 overflow-auto text-xs border rounded p-2 bg-white space-y-1">
        {msgs.map((m,i)=> {
          const who = m.mine ? selfLabel : peerLabel;
          const t = new Date(m.ts).toLocaleTimeString();
          return (
            <div key={i} className={m.mine ? "text-right" : "text-left"}>
              <span className="opacity-60">{t}</span>{sep()}
              <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100">{who}</span>{sep()}
              <span className={m.mine ? "font-medium" : ""}>{m.text}</span>
            </div>
          );
        })}
        {peerTyping && <div className="italic opacity-60">typing</div>}
      </div>
      <div className="flex gap-2">
        <input
          className="border rounded px-2 py-1 flex-1"
          value={val}
          onChange={e=>onInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Chat (Enter = send, Shift+Enter = newline)" />
        <button className="border rounded px-3 py-1" onClick={sendNow}>Send</button>
      </div>
    </div>
  );
}