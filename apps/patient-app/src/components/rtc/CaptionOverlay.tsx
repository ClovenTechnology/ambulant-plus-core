"use client";
export default function CaptionOverlay({ text }:{ text:string }){
  if(!text) return null;
  return (
    <div className="absolute bottom-2 left-2 right-2">
      <div className="inline-block max-w-[90%] bg-black/70 text-white text-xs rounded px-2 py-1 shadow">
        {text}
      </div>
    </div>
  );
}