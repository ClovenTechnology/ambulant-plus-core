"use client";
import { useEffect, useRef, useState } from "react";
import { createPeer, addLocalTracks, makeOffer, acceptOffer, acceptAnswer, setPeerId } from "rtc-core";
import { DeviceSettings } from "@ambulant/rtc";

type SigMsg =
  | { type: "welcome"; clientId: string; peers: string[] }
  | { type: "peer-joined"; clientId: string }
  | { type: "peer-left"; clientId: string }
  | { type: "signal"; from: string; data: any }
  | { type: "chat"; from: string; text: string; ts: number };

export default function Call({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const [clientId, setClientId] = useState<string>("");
  const [peers, setPeers] = useState<string[]>([]);
  const [chat, setChat] = useState<{from:string;text:string;ts:number}[]>([]);
  const [wsReady, setWsReady] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const streamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const peerMap = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStream = useRef<MediaStream | null>(null);

  const [micOn,setMicOn]=useState(true);
  const [camOn,setCamOn]=useState(true);

  const [settings, setSettings] = useState<{ micId?: string; camId?: string; sinkId?: string }>({});

  useEffect(() => {
    // connect socket
    let ws = new WebSocket(`ws://localhost:${process.env.NEXT_PUBLIC_RTC_SIGNAL_PORT || "4010"}`);
    wsRef.current = ws;
    ws.onopen = () => {
      setWsReady(true);
      ws.send(JSON.stringify({ type: "join", roomId, role: "patient" }));
    };
    ws.onmessage = async (ev) => {
      const msg: SigMsg = JSON.parse(ev.data);
      if (msg.type === "welcome") {
        setClientId(msg.clientId);
        setPeers(msg.peers);
        for (const pid of msg.peers) {
          await callPeer(pid);
        }
      }
      if (msg.type === "peer-joined") {
        setPeers(p => Array.from(new Set([...p, msg.clientId])));
        await callPeer(msg.clientId);
      }
      if (msg.type === "peer-left") {
        peerMap.current.get(msg.clientId)?.close();
        peerMap.current.delete(msg.clientId);
        setPeers(p => p.filter(x => x !== msg.clientId));
      }
      if (msg.type === "signal") {
        await handleSignal(msg.from, msg.data);
      }
      if (msg.type === "chat") {
        setChat(c => [...c, { from: msg.from, text: msg.text, ts: msg.ts }]);
      }
    };
    ws.onclose = () => setWsReady(false);
    return () => { try { ws.close(); } catch {} };
  }, [roomId]);

  // (re)apply sink to all media elements
  useEffect(() => {
    (async()=>{
      const els = [...Array.from(document.querySelectorAll("video")), ...Array.from(document.querySelectorAll("audio"))] as HTMLMediaElement[];
      for (const el of els) {
        // @ts-ignore
        if (settings?.sinkId && typeof (el as any).setSinkId === "function") {
          try { await (el as any).setSinkId(settings.sinkId); } catch {}
        }
      }
    })();
  }, [settings?.sinkId]);

  async function ensureLocal() {
    // (re)acquire with chosen devices
    const audio: MediaTrackConstraints | boolean = settings?.micId ? { deviceId: settings.micId } : true;
    const video: MediaTrackConstraints | boolean = settings?.camId ? { deviceId: settings.camId } : true;

    if (localStream.current) {
      try { localStream.current.getTracks().forEach(t => t.stop()); } catch {}
      localStream.current = null;
    }
    const s = await navigator.mediaDevices.getUserMedia({ video, audio });
    localStream.current = s;
    if (localRef.current) localRef.current.srcObject = s;
    return s;
  }

  async function callPeer(pid: string) {
    if (peerMap.current.has(pid)) return;
    const pc = createPeer(onRemoteTrack);
    setPeerId(pc, pid);
    peerMap.current.set(pid, pc);
    const s = await ensureLocal();
    addLocalTracks(pc, s);
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        wsRef.current?.send(JSON.stringify({ type: "signal", to: pid, data: { candidate: ev.candidate } }));
      }
    };
    const offer = await makeOffer(pc);
    wsRef.current?.send(JSON.stringify({ type: "signal", to: pid, data: { offer } }));
  }

  async function handleSignal(from: string, data: any) {
    if (!peerMap.current.has(from)) {
      const pc = createPeer(onRemoteTrack);
      setPeerId(pc, from);
      peerMap.current.set(from, pc);
      const s = await ensureLocal();
      addLocalTracks(pc, s);
      pc.onicecandidate = (ev) => {
        if (ev.candidate) wsRef.current?.send(JSON.stringify({ type: "signal", to: from, data: { candidate: ev.candidate } }));
      };
    }
    const pc = peerMap.current.get(from)!;
    if (data.offer) {
      const answer = await acceptOffer(pc, data.offer);
      wsRef.current?.send(JSON.stringify({ type: "signal", to: from, data: { answer } }));
    } else if (data.answer) {
      await acceptAnswer(pc, data.answer);
    } else if (data.candidate) {
      try { await pc.addIceCandidate(data.candidate); } catch {}
    }
  }

  function onRemoteTrack(ev: RTCTrackEvent, from: string) {
    let stream = streamsRef.current.get(from);
    if (!stream) {
      stream = new MediaStream();
      streamsRef.current.set(from, stream);
    }
    if (!stream.getTracks().find(t => t.id === ev.track.id)) {
      stream.addTrack(ev.track);
    }
    const el = remoteRefs.current.get(from);
    if (el) el.srcObject = stream;
  }

  async function toggleMic() {
    const s = localStream.current ?? await ensureLocal();
    const aud = s.getAudioTracks()[0];
    if (aud) { aud.enabled = !aud.enabled; setMicOn(aud.enabled); }
    // update senders
    for (const pc of peerMap.current.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === "audio");
      if (sender && aud) try { await sender.replaceTrack(aud); } catch {}
    }
  }
  async function toggleCam() {
    const s = localStream.current ?? await ensureLocal();
    const vid = s.getVideoTracks()[0];
    if (vid) { vid.enabled = !vid.enabled; setCamOn(vid.enabled); }
    // update senders
    for (const pc of peerMap.current.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender && vid) try { await sender.replaceTrack(vid); } catch {}
    }
  }
  async function shareScreen() {
    const scr = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
    const track = scr.getVideoTracks()[0];
    for (const pc of peerMap.current.values()) {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
      if (sender) await sender.replaceTrack(track);
    }
    track.onended = async () => {
      const vs = localStream.current?.getVideoTracks()[0];
      for (const pc of peerMap.current.values()) {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
        if (sender && vs) await sender.replaceTrack(vs);
      }
    }
  }
  function sendChat(text: string) {
    wsRef.current?.send(JSON.stringify({ type: "chat", text }));
  }

  function leave() {
    try { wsRef.current?.close(); } catch {}
    try {
      for (const pc of peerMap.current.values()) { try { pc.close(); } catch {} }
      peerMap.current.clear();
      for (const s of streamsRef.current.values()) { try { s.getTracks().forEach(t=>t.stop()); } catch {} }
      streamsRef.current.clear();
      localStream.current?.getTracks().forEach(t=>t.stop());
      localStream.current = null;
    } catch {}
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">RTC Call — Room {roomId}</h1>
      <div className="flex gap-2 flex-wrap">
        <button onClick={toggleMic} className="px-3 py-1 border rounded">{micOn ? "Mute" : "Unmute"}</button>
        <button onClick={toggleCam} className="px-3 py-1 border rounded">{camOn ? "Stop Cam" : "Start Cam"}</button>
        <button onClick={shareScreen} className="px-3 py-1 border rounded">Share Screen</button>
        <button onClick={leave} className="px-3 py-1 border rounded">Leave</button>

        <details className="ml-2 border rounded px-3 py-1">
          <summary className="cursor-pointer select-none">Settings</summary>
          <div className="mt-2">
            <DeviceSettings value={settings} onChange={setSettings} />
          </div>
        </details>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <video ref={localRef} autoPlay playsInline muted className="w-full aspect-video bg-black rounded" />
        {peers.map(pid => (
          <video key={pid} ref={el => el && remoteRefs.current.set(pid, el)} autoPlay playsInline className="w-full aspect-video bg-black rounded" />
        ))}
      </div>

      <ChatPanel onSend={sendChat} items={chat} selfId={clientId} />
    </main>
  );
}

function ChatPanel({ onSend, items, selfId }: { onSend: (t: string)=>void; items: {from:string;text:string;ts:number}[]; selfId: string }) {
  const [text,setText]=useState("");
  return (
    <section className="border rounded p-3 bg-white">
      <div className="font-medium mb-2">Chat</div>
      <div className="h-40 overflow-auto border rounded p-2 mb-2 bg-gray-50 text-sm">
        {items.map((m,i)=>(
          <div key={i}><span className="text-gray-500">{m.from===selfId?"You":m.from}:</span> {m.text}</div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={e=>setText(e.target.value)} className="flex-1 border rounded px-2 py-1" placeholder="Type a message" />
        <button onClick={()=>{ if(text.trim()){ onSend(text.trim()); setText(""); } }} className="px-3 py-1 border rounded bg-black text-white">Send</button>
      </div>
    </section>
  )
}
