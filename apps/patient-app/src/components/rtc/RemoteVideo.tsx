"use client";
// v16.0-A4.1 enforced forwardRef
import React, { forwardRef, useEffect, useRef } from "react";

type Props = {
  stream: MediaStream|null;
  idAttr?: string;
  overlayText?: string;
};

const RemoteVideo = forwardRef<HTMLVideoElement, Props>(function RemoteVideo(
  { stream, idAttr, overlayText }, ref
){
  const videoRef = useRef<HTMLVideoElement|null>(null);

  useEffect(()=>{
    const v = videoRef.current;
    if(!v) return;
    v.srcObject = stream ?? null;
  }, [stream]);

  // Mirror inner ref to parent if provided
  useEffect(()=>{
    if(ref && typeof ref === "object") {
      (ref as any).current = videoRef.current;
    }
  }, [ref]);

  return (
    <div className="relative border rounded overflow-hidden">
      <video
        ref={videoRef}
        id={idAttr}
        className="w-full aspect-video bg-black"
        autoPlay
        playsInline
      />
      {overlayText
        ? <div className="absolute bottom-2 left-2 right-2">
            <div className="inline-block max-w-[90%] bg-black/70 text-white text-xs rounded px-2 py-1 shadow">
              {overlayText}
            </div>
          </div>
        : null}
    </div>
  );
});

export default RemoteVideo;