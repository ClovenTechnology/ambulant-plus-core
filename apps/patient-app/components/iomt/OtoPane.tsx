// apps/patient-app/components/iomt/OtoPane.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

export default function OtoPane() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const recRef = useRef<MediaRecorder|null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  async function ensureStream() {
    if (streamRef.current) return streamRef.current;
    // USB camera support depends on device; this uses default camera as placeholder
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    streamRef.current = s;
    if (videoRef.current) videoRef.current.srcObject = s;
    return s;
  }

  async function startVideo() {
    await ensureStream();
    if (!videoRef.current) return;
    await videoRef.current.play();
    const rec = new MediaRecorder(streamRef.current!);
    rec.ondataavailable = e=>chunksRef.current.push(e.data);
    rec.onstop = ()=>{
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      a.href = URL.createObjectURL(blob);
      a.download = `oto-${ts}.webm`; // MP4 when encoder/bridge available
      a.click();
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  function stopVideo() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function takePhoto() {
    await ensureStream();
    const canvas = document.createElement('canvas');
    const v = videoRef.current!;
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob((blob)=>{
      if (!blob) return;
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      a.href = URL.createObjectURL(blob);
      a.download = `oto-${ts}.png`;
      a.click();
    }, 'image/png');
  }

  useEffect(()=>()=>{ // cleanup on unmount
    recRef.current?.stop();
    streamRef.current?.getTracks().forEach(t=>t.stop());
  },[]);

  return (
    <div className="space-y-3">
      <video ref={videoRef} className="w-full rounded-xl border bg-black" playsInline muted />
      <div className="flex gap-2">
        <button onClick={takePhoto} className="px-4 py-2 rounded-xl border">Photo</button>
        {!recording
          ? <button onClick={startVideo} className="px-4 py-2 rounded-xl border bg-zinc-900 text-white">Start Video</button>
          : <button onClick={stopVideo} className="px-4 py-2 rounded-xl border bg-red-600 text-white">Stop Video</button>}
      </div>
      <div className="text-xs text-zinc-500">Buttons remain usable if you stop and start again.</div>
    </div>
  );
}
