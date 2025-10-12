"use client";
export function buildIceServers(): RTCIceServer[] {
  const servers: RTCICEserver[] | RTCIceServer[] = [{ urls:"stun:stun.l.google.com:19302" }];
  const url = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const credential = process.env.NEXT_PUBLIC_TURN_PASSWORD?.trim();
  if(url){
    const urls = url.split(",").map(s=>s.trim()).filter(Boolean);
    servers.push({ urls, username, credential });
  }
  return servers as RTCIceServer[];
}