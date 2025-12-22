// apps/patient-app/app/televisit/[id]/televisit-client.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

const STUN = [{ urls: 'stun:stun.l.google.com:19302' }];

type Msg =
  | { type: 'hello'; from?: string }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; candidate: RTCIceCandidateInit }
  | { type: 'bye' };

function serializeCandidate(c: RTCIceCandidate): RTCIceCandidateInit {
  // Ensure plain JSON (works across BroadcastChannel)
  // @ts-ignore
  if (typeof c.toJSON === 'function') return c.toJSON();
  return {
    candidate: c.candidate,
    sdpMid: c.sdpMid ?? undefined,
    sdpMLineIndex: c.sdpMLineIndex ?? undefined,
    usernameFragment: (c as any).usernameFragment,
  };
}

export default function TelevisitClient({ id }: { id: string }) {
  const [status, setStatus] = useState<'idle' | 'preview' | 'calling' | 'connected'>('idle');

  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const ensurePreview = async () => {
    if (streamRef.current) return streamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    streamRef.current = stream;

    if (localVideo.current) {
      localVideo.current.srcObject = stream;
      await localVideo.current.play().catch(() => {});
    }

    setStatus((prev) => (prev === 'idle' ? 'preview' : prev));
    return stream;
  };

  const ensurePC = async () => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({ iceServers: STUN });
    pcRef.current = pc;

    const local = await ensurePreview();
    local.getTracks().forEach((t) => pc.addTrack(t, local));

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = remoteStream;
        remoteVideo.current.play().catch(() => {});
      }
      setStatus('connected');
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && bcRef.current) {
        bcRef.current.postMessage({ type: 'ice', candidate: serializeCandidate(e.candidate) } as Msg);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setStatus('preview');
      }
    };

    return pc;
  };

  const closePC = () => {
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    remoteStreamRef.current = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  };

  useEffect(() => {
    const bc = new BroadcastChannel(`televisit-${id}`);
    bcRef.current = bc;

    bc.postMessage({ type: 'hello' } as Msg);

    bc.onmessage = async (ev: MessageEvent<Msg>) => {
      const msg = ev.data;
      if (!msg) return;

      if (msg.type === 'offer') {
        const pc = await ensurePC();
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        bc.postMessage({ type: 'answer', sdp: ans } as Msg);
        setStatus('calling');
      }

      if (msg.type === 'answer') {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      }

      if (msg.type === 'ice') {
        const pc = pcRef.current;
        if (!pc || !msg.candidate) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch {}
      }

      if (msg.type === 'bye') {
        closePC();
      }
    };

    return () => {
      try {
        bc.postMessage({ type: 'bye' } as Msg);
      } catch {}
      bc.close();
      closePC();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (localVideo.current) localVideo.current.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const startCall = async () => {
    const pc = await ensurePC();
    setStatus('calling');

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    bcRef.current?.postMessage({ type: 'offer', sdp: offer } as Msg);
  };

  const hangup = () => {
    try {
      bcRef.current?.postMessage({ type: 'bye' } as Msg);
    } catch {}
    closePC();
    setStatus('preview');
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="aspect-video bg-black rounded overflow-hidden">
          <video ref={localVideo} muted playsInline className="w-full h-full object-cover" />
        </div>
        <div className="aspect-video bg-black rounded overflow-hidden">
          <video ref={remoteVideo} playsInline className="w-full h-full object-cover" />
        </div>
      </div>

      <div className="flex gap-2">
        <button className="px-3 py-2 border rounded" onClick={ensurePreview}>
          {status === 'idle' ? 'Enable Camera' : 'Camera On'}
        </button>

        <button
          className="px-3 py-2 border rounded bg-emerald-600 text-white disabled:opacity-50"
          onClick={startCall}
          disabled={status === 'calling' || status === 'connected'}
        >
          {status === 'connected' ? 'Connected' : status === 'calling' ? 'Calling…' : 'Start Call'}
        </button>

        <button className="px-3 py-2 border rounded" onClick={hangup} disabled={status !== 'connected' && status !== 'calling'}>
          Hang up
        </button>
      </div>
    </div>
  );
}
