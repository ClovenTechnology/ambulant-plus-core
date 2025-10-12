"use client";
import { useEffect, useRef } from "react";

type Props = {
  active: boolean;
  micOn: boolean;
  camOn: boolean;
  deviceIds?: { audioId?: string|null; videoId?: string|null };
  onStream?: (s: MediaStream|null)=>void;
};

export default function LocalMedia({ active, micOn, camOn, deviceIds, onStream }: Props){
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const streamRef = useRef<MediaStream|null>(null);

  // Acquire/teardown
  useEffect(()=>{
    if(!active){
      if(streamRef.current){
        streamRef.current.getTracks().forEach(t=>t.stop());
        onStream?.(null);
      }
      streamRef.current = null;
      if(videoRef.current){ videoRef.current.srcObject = null; }
      return;
    }

    let cancelled = false;
    (async ()=>{
      try{
        const audio: MediaTrackConstraints | boolean =
          { echoCancellation:true, noiseSuppression:true, autoGainControl:true, ...(deviceIds?.audioId ? { deviceId: { exact: deviceIds.audioId } } : {}) };
        const video: MediaTrackConstraints | boolean =
          { width:1280, height:720, ...(deviceIds?.videoId ? { deviceId: { exact: deviceIds.videoId } } : {}) };

        const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
        if(cancelled) return;

        streamRef.current = stream;

        // initial states
        stream.getAudioTracks().forEach(t => t.enabled = micOn);
        stream.getVideoTracks().forEach(t => t.enabled = camOn);

        if(videoRef.current){ videoRef.current.srcObject = stream; }
        onStream?.(stream);
      }catch(err){
        console.error("getUserMedia failed", err);
        if(videoRef.current){ videoRef.current.poster = ""; }
      }
    })();

    return ()=>{ cancelled = true; };
  }, [active, deviceIds?.audioId, deviceIds?.videoId]);

  // React to mic/cam toggles WITHOUT replacing tracks
  useEffect(()=>{
    const s = streamRef.current; if(!s) return;
    s.getAudioTracks().forEach(t => t.enabled = micOn);
  }, [micOn]);

  useEffect(()=>{
    const s = streamRef.current; if(!s) return;
    s.getVideoTracks().forEach(t => t.enabled = camOn);
  }, [camOn]);

  return (
    <div className="border rounded overflow-hidden">
      <video
        ref={videoRef}
        className="w-full aspect-video bg-black"
        autoPlay
        playsInline
        muted
      />
    </div>
  );
}