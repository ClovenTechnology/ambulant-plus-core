"use client";
import React, { useEffect, useRef, useState } from "react";
import { SessionTimer } from "@ambulant/ui";

export type RTCShellProps = {
  durationSec?: number;
  showTimer?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  onSnapshot?: (blob: Blob) => void;
};

export default function RTCShell({
  durationSec = 1800,
  showTimer = true,
  onStart,
  onStop,
  onSnapshot,
}: RTCShellProps) {
  const [joined, setJoined] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const localVideo = useRef<HTMLVideoElement>(null);
  const screenVideo = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, []);

  async function join() {
    try {
      if (!localStream.current) {
        localStream.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }
      if (localVideo.current) {
        localVideo.current.srcObject = localStream.current;
        await localVideo.current.play().catch(() => {});
      }
      setJoined(true);
      setCamOn(true);
      setMicOn(true);
      onStart?.();
    } catch (e) {
      console.error("join error", e);
    }
  }

  function stopAll() {
    for (const ms of [localStream.current, screenStream.current]) {
      ms?.getTracks().forEach((t) => t.stop());
    }
    localStream.current = null;
    screenStream.current = null;
    setJoined(false);
    setCamOn(false);
    setMicOn(false);
    setScreenOn(false);
    onStop?.();
  }

  function leave() {
    stopAll();
  }

  function toggleCam() {
    const v = localStream.current?.getVideoTracks()[0];
    if (v) {
      v.enabled = !v.enabled;
      setCamOn(v.enabled);
    }
  }

  function toggleMic() {
    const a = localStream.current?.getAudioTracks()[0];
    if (a) {
      a.enabled = !a.enabled;
      setMicOn(a.enabled);
    }
  }

  async function toggleScreen() {
    try {
      if (!screenOn) {
        // start
        const s = await (navigator.mediaDevices as any).getDisplayMedia({
          video: true,
        });
        screenStream.current = s;
        if (screenVideo.current) {
          screenVideo.current.srcObject = s;
          await screenVideo.current.play().catch(() => {});
        }
        setScreenOn(true);
        s.getVideoTracks()[0].addEventListener("ended", () => {
          // user stopped share from browser UI
          setScreenOn(false);
          screenStream.current?.getTracks().forEach((t) => t.stop());
          screenStream.current = null;
        });
      } else {
        // stop
        screenStream.current?.getTracks().forEach((t) => t.stop());
        screenStream.current = null;
        setScreenOn(false);
      }
    } catch (e) {
      console.error("screen error", e);
    }
  }

  async function snapshot() {
    try {
      const video = screenOn ? screenVideo.current : localVideo.current;
      if (!video) return;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 360;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (blob) {
          onSnapshot?.(blob);
          // also trigger a download for convenience
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "snapshot.png";
          a.click();
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } catch (e) {
      console.error("snapshot error", e);
    }
  }

  return (
    <div className="p-4 bg-white rounded-xl border space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Telehealth Session</div>
        {showTimer && <SessionTimer durationSec={durationSec} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <video ref={localVideo} className="w-full rounded-lg bg-black" muted playsInline />
        <video ref={screenVideo} className="w-full rounded-lg bg-black" muted playsInline />
      </div>

      <div className="flex items-center gap-2">
        {!joined ? (
          <button onClick={join} className="px-3 py-2 rounded-lg bg-green-600 text-white">Join Session</button>
        ) : (
          <button onClick={leave} className="px-3 py-2 rounded-lg bg-red-600 text-white">Leave Session</button>
        )}

        <button onClick={toggleCam} disabled={!joined} className="px-3 py-2 rounded-lg border disabled:opacity-50">
          {camOn ? "Cam Off" : "Cam On"}
        </button>
        <button onClick={toggleMic} disabled={!joined} className="px-3 py-2 rounded-lg border disabled:opacity-50">
          {micOn ? "Mute" : "Unmute"}
        </button>
        <button onClick={toggleScreen} disabled={!joined} className="px-3 py-2 rounded-lg border disabled:opacity-50">
          {screenOn ? "Stop Share" : "Share Screen"}
        </button>
        <button onClick={snapshot} disabled={!joined} className="px-3 py-2 rounded-lg border disabled:opacity-50">
          Screenshot
        </button>
      </div>
    </div>
  );
}