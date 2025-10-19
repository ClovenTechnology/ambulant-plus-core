// apps/patient-app/app/rtc/page.tsx
import RemoteAudio from '@/components/rtc/RemoteAudio';
'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import LocalMedia from '@/src/components/rtc/LocalMedia';
import RemoteVideo from '@/src/components/rtc/RemoteVideo';
import DeviceSelect from '@/src/components/rtc/DeviceSelect';
import OutputSelect from '@/src/components/rtc/OutputSelect';
import ChatPanel from '@/src/components/rtc/ChatPanel';
import StatsPanel from '@/src/components/rtc/StatsPanel';
import Captions from '@/src/components/rtc/Captions';
import { connectSignal, type SigMsg } from '@/src/lib/signal';
import { buildIceServers } from '@/src/lib/ice';

// NEW: XR provider + hook
import { XRProvider, useXR } from '@/components/xr/XRContext';

const ROLE = 'patient' as const;
const ROOM = 'demo-rtc';

// Sender params: video-only, keep existing codecs, bail if missing, encodings guarded
function applySenderParams(pc: RTCPeerConnection){
  try{
    pc.getSenders()
      .filter(s => s.track?.kind === 'video' && typeof (s as any).getParameters === 'function')
      .forEach(s=>{
        try{
          const cur = s.getParameters() as RTCRtpParameters;
          if(!cur || !Array.isArray((cur as any).codecs) || (cur as any).codecs.length === 0){
            return;
          }
          const encs = Array.isArray(cur.encodings) ? [...cur.encodings] : [];
          if(encs.length === 0) encs.push({});
          encs[0] = { ...encs[0], maxBitrate: 1_000_000 };
          (s as any).setParameters({ codecs: (cur as any).codecs, encodings: encs });
        }catch(e){ /* per-sender issue ignored */ }
      });
  }catch{}
}

function RTCInner(){
  // useXR hook for toggling exposure
  const { setXrStream, setVideoSrc, setExposeToWindow, exposeToWindow, videoSrc } = useXR();

  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteStream, setRemoteStream] = useState<MediaStream|null>(null);
  const [localStream, setLocalStream] = useState<MediaStream|null>(null);
  const [deviceIds, setDeviceIds] = useState<{audioId:string|null; videoId:string|null}>({audioId:null, videoId:null});
  const [log, setLog] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [remotePeerId, setRemotePeerId] = useState<string|null>(null);
  const [waiting, setWaiting] = useState<boolean>(true);
  const [remoteMuted, setRemoteMuted] = useState<boolean>(false);

  const SELF_NAME  = process.env.NEXT_PUBLIC_SELF_NAME  || 'Me';
  const PEER_NAME  = process.env.NEXT_PUBLIC_PEER_NAME  || (ROLE === 'clinician' ? 'Patient' : 'Clinician');

  const id = useMemo(()=> (typeof crypto!=='undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : Math.random().toString(36).slice(2), []);
  const pcRef = useRef<RTCPeerConnection|null>(null);
  const sigRef = useRef<ReturnType<typeof connectSignal>|null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement|null>(null);
  const caller = false;
  const polite = true;

  const makingOffer = useRef(false);
  const pendingIce = useRef<any[]>([]);

  function append(msg:string){ setLog(l=>[...l, msg].slice(-400)); }

  useEffect(()=>{
    if(!active){
      sigRef.current?.close(); sigRef.current = null;
      if(pcRef.current){
        try { pcRef.current.getSenders().forEach(s=>{ try{ s.track?.stop(); }catch{} }); } catch {}
        try { pcRef.current.close(); } catch {}
      }
      pcRef.current = null;
      setRemoteStream(null);
      append('session: stopped');
      return;
    }

    append('session: starting…');

    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    pcRef.current = pc;

    const inbound = new MediaStream();
    setRemoteStream(inbound);

    pc.ontrack = (ev)=>{
      const s = ev.streams[0] ?? inbound;
      if(ev.track && !s.getTracks().includes(ev.track)){ s.addTrack(ev.track); }
      setRemoteStream(s);
      append('webrtc: ontrack ('+ ev.track.kind +')');
    };

    pc.onicecandidate = (ev)=>{ if(ev.candidate){ sigRef.current?.send({ type:'ice', data: ev.candidate }); } };
    pc.oniceconnectionstatechange = ()=> append('pc: ice=' + pc.iceConnectionState);
    pc.onconnectionstatechange    = ()=> append('pc: conn=' + pc.connectionState);

    pc.onnegotiationneeded = async ()=>{
      try{
        if(!caller) return;
        if(pc.signalingState !== 'stable') return;
        makingOffer.current = true;
        const off = await pc.createOffer();
        await pc.setLocalDescription(off);
        sigRef.current?.send({ type:'offer', data: pc.localDescription });
        append('signal: offer → (negotiationneeded)');
      }catch(e){ console.error(e); }
      finally { makingOffer.current = false; }
    };

    const sig = connectSignal('ws://localhost:8787', ROOM, id, async (m:SigMsg)=>{
      try{
        if(m.type==="_open"){ append('signal: connected');
          sigRef.current?.send({ type:"join", room:ROOM, id, role: ROLE });
          if(true){ sigRef.current?.send({ type:"knock" }); append('lobby: knocked') }
          return;
        }
        if(m.type==="_close"){ append('signal: closed'); return; }
        if(m.type==="_error"){ append('signal: error'); return; }

        if(m.type==='admitted'){ append('lobby: admitted'); setWaiting(false); return; }
        if(m.type==='rejected'){ append('lobby: rejected'); setWaiting(true); return; }
        if(m.type==='knock' && ROLE==='clinician'){ append('lobby: knock from '+(m.id||'peer')); setRemotePeerId(m.id||null); return; }

        if(m.type==='join'){ setRemotePeerId(m.id||null); append('peer join: ' + (m.id ?? 'unknown')); }

        if(m.type==='ctrl' && m.key==='remote-mic'){
          const wantOff = !!m.off;
          setRemoteMuted(wantOff);
          if(localStream){
            localStream.getAudioTracks().forEach(t=> t.enabled = !wantOff && micOn);
          }
          if(ROLE==='patient'){ setMicOn(!wantOff); }
          return;
        }

        if(m.type==='typing'){ (window as any).__peerTyping?.(!!m.on); return; }
        if(m.type==='chat'){ (window as any).__chatAdd?.({ id: m.id||'peer', text: m.text||'', ts: Date.now(), mine:false }); return; }

        if(m.type==='offer'){
          append('signal: offer ←');
          const offer = m.data as RTCSessionDescriptionInit;
          const isCollision = makingOffer.current || pc.signalingState !== 'stable';

          if(isCollision){
            if(!polite){
              append('negotiation: glare (impolite ignores)');
              return;
            }
            append('negotiation: glare (polite rolls back)');
            await pc.setLocalDescription({ type:'rollback' } as RTCSessionDescriptionInit);
          }

          await pc.setRemoteDescription(offer);
          const ans = await pc.createAnswer();
          append('webrtc: created answer');
          await pc.setLocalDescription(ans);
          sigRef.current?.send({ type:'answer', data: pc.localDescription });
          append('signal: answer →');

          if(pc.remoteDescription){
            for(const c of pendingIce.current.splice(0)){
              try{ await pc.addIceCandidate(c); }catch(e){ console.error(e); }
            }
          }
        }
        else if(m.type==='answer'){
          append('signal: answer ←');
          if(pc.signalingState === 'have-local-offer'){
            await pc.setRemoteDescription(m.data as RTCSessionDescriptionInit);
          }else{
            append('warn: answer ignored (state=' + pc.signalingState + ')');
          }
        }
        else if(m.type==='ice' && m.data){
          if(pc.remoteDescription) {
            await pc.addIceCandidate(m.data);
          } else {
            pendingIce.current.push(m.data);
          }
        }
      }catch(e){ console.error(e); append('error: '+(e as Error).message); }
    });
    sigRef.current = sig;
  }, [active]);

  // local tracks / params
  useEffect(()=>{
    const pc = pcRef.current;
    if(!pc || !active) return;

    pc.getSenders()
      .filter(s => s.track && (s.track.kind === 'audio' || s.track.kind === 'video'))
      .forEach(s => { try{ pc.removeTrack(s); }catch{} });

    if(localStream){
      localStream.getAudioTracks().forEach(t => t.enabled = micOn && !remoteMuted);
      localStream.getVideoTracks().forEach(t => t.enabled = camOn);
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
      append('webrtc: local tracks ready (' + localStream.getTracks().map(t=>t.kind).join(',') + ')');
      applySenderParams(pc);
      append('webrtc: sender params applied');
    }else{
      append('webrtc: no local tracks');
    }
  }, [localStream, active, micOn, camOn, remoteMuted, deviceIds.audioId, deviceIds.videoId]);

  async function toggleShare(){
    const pc = pcRef.current; if(!pc) return;
    if(!sharing){
      try{
        const ds = await (navigator.mediaDevices as any).getDisplayMedia({ video:true, audio:true });
        setSharing(true);
        const v = ds.getVideoTracks()[0];
        const a = ds.getAudioTracks()[0];
        const sendV = pc.getSenders().find(s=>s.track?.kind==='video');
        if(sendV && v) await sendV.replaceTrack(v);
        const sendA = pc.getSenders().find(s=>s.track?.kind==='audio');
        if(sendA && a) await sendA.replaceTrack(a);
        v?.addEventListener('ended', ()=>{ setSharing(false); });
        append('share: screen on');
      }catch{}
    }else{
      setSharing(false);
      if(localStream){
        const v = localStream.getVideoTracks()[0];
        const a = localStream.getAudioTracks()[0];
        const sendV = pc.getSenders().find(s=>s.track?.kind==='video');
        if(sendV && v) await sendV.replaceTrack(v);
        const sendA = pc.getSenders().find(s=>s.track?.kind==='audio');
        if(sendA && a) await sendA.replaceTrack(a);
        append('share: screen off');
      }
    }
  }

  function admitPeer(){ if(sigRef.current && remotePeerId){ sigRef.current.send({ type:'admit', target: remotePeerId }); } }
  function sendChat(t:string){ sigRef.current?.send({ type:"chat", text:t }); }
  function setTyping(on:boolean){ sigRef.current?.send({ type:"typing", on }); }

  function toggleRemoteMic(){
    if(ROLE!=='clinician' || !remotePeerId) return;
    const nextOff = !remoteMuted;
    setRemoteMuted(nextOff);
    sigRef.current?.send({ type:"ctrl", key:"remote-mic", off: nextOff, target: remotePeerId });
  }

  // whenever remoteStream changes we keep the provider in sync when exposing
  useEffect(() => {
    // set provider stream only if user toggled expose
    if (remoteStream && exposeToWindow) {
      try {
        setXrStream(remoteStream);
        (window as any).__XR_STREAM = remoteStream;
      } catch {}
    } else if (!remoteStream && exposeToWindow) {
      // clear provider if stream ended
      try {
        setXrStream(null);
        delete (window as any).__XR_STREAM;
      } catch {}
    }
  }, [remoteStream, exposeToWindow, setXrStream]);

  // UI: add "Expose Remote to XR" toggle that sets provider and window.__XR_STREAM
  const [exposeToggle, setExposeToggle] = useState(false);
  useEffect(() => {
    setExposeToWindow(exposeToggle);
    if (exposeToggle && remoteStream) {
      try {
        setXrStream(remoteStream);
        (window as any).__XR_STREAM = remoteStream;
      } catch {}
    } else {
      try {
        setXrStream(null);
        delete (window as any).__XR_STREAM;
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exposeToggle]);

  return (
    <main className='p-6 space-y-4'>
      <h1 className='text-xl font-semibold'>Patient — RTC</h1>

      <div className='flex gap-4 flex-col md:flex-row'>
        <div className='md:w-1/2 space-y-3'>
          <div className='border rounded p-3 space-y-2'>
            <div className='text-sm opacity-70'>Controls</div>
            <div className='flex gap-2 flex-wrap'>
              { !active
                ? <button className='border rounded px-3 py-1' onClick={()=>setActive(true)}>Start Session</button>
                : <button className='border rounded px-3 py-1' onClick={()=>setActive(false)}>End Session</button> }
              <button className='border rounded px-3 py-1' onClick={()=>setMicOn(v=>!v)}>{ micOn ? 'Mute Mic' : 'Unmute Mic' }</button>
              <button className='border rounded px-3 py-1' onClick={()=>setCamOn(v=>!v)}>{ camOn ? 'Camera Off' : 'Camera On' }</button>
              <button className='border rounded px-3 py-1' onClick={toggleShare}>{ sharing ? 'Stop Share' : 'Share Screen' }</button>

              {/* NEW: expose remote stream to XR */}
              <button
                className={`border rounded px-3 py-1 ${exposeToggle ? 'bg-blue-600 text-white' : ''}`}
                onClick={() => setExposeToggle(v => !v)}
                title="Expose remote stream to XR (window.__XR_STREAM)"
              >
                { exposeToggle ? 'Stop Expose to XR' : 'Expose Remote to XR' }
              </button>

              { ROLE==='clinician' &&
                <button className='border rounded px-3 py-1' onClick={toggleRemoteMic}>
                  { remoteMuted ? 'Unmute Patient' : 'Mute Patient' }
                </button> }
            </div>
            <div className='text-xs opacity-70'>Room: {ROOM} • Role: {ROLE}</div>
          </div>

          <details className='border rounded p-3'>
            <summary className='cursor-pointer select-none'>Devices</summary>
            <div className='mt-2 grid md:grid-cols-2 gap-3'>
              <DeviceSelect audioId={deviceIds.audioId} videoId={deviceIds.videoId} onChange={setDeviceIds} />
              <OutputSelect videoRef={remoteVideoRef} />
            </div>
          </details>

          <div className='space-y-2'>
            <div className='text-sm font-medium'>Local Preview</div>
            <LocalMedia
              active={active}
              micOn={micOn && !remoteMuted}
              camOn={camOn}
              deviceIds={deviceIds}
              onStream={setLocalStream}
            />
          </div>

          <div className='space-y-2'>
            <div className='text-sm font-medium'>Remote Preview</div>
            <RemoteVideo onStream={setRemoteStream} />
          </div>
        </div>

        <div className='md:w-1/2 space-y-3'>
          { ROLE==='clinician' && waiting &&
            <div className='border rounded p-3 space-y-2'>
              <div className='text-sm font-medium'>Lobby</div>
              <div className='text-xs opacity-70'>A participant is waiting to join.</div>
              <div className='flex gap-2'>
                <button className='border rounded px-3 py-1' onClick={admitPeer}>Admit</button>
              </div>
            </div>
          }

          <ChatPanel send={sendChat} onTyping={setTyping} selfLabel={SELF_NAME || 'Me'} peerLabel={PEER_NAME} />

          <details className='border rounded p-3'>
            <summary className='cursor-pointer select-none'>Network Stats</summary>
            <div className='mt-2'>
              <StatsPanel pc={pcRef.current} />
            </div>
          </details>

          <Captions lang="en-UK" />

          <details className='border rounded p-3'>
            <summary className='cursor-pointer select-none'>Status</summary>
            <div className='mt-2'>
              <pre className='text-xs whitespace-pre-wrap leading-tight max-h-80 overflow-auto'>
{log.map((l,i)=> <span key={i}>{l}{"\n"}</span>)}
              </pre>
            </div>
          </details>
        </div>
      </div>
    </main>
  );
}

export default function RTC(){
  // Wrap the original RTC UI in XRProvider so the expose button works.
  return (
    <XRProvider>
      <RTCInner />
    </XRProvider>
  );
}
