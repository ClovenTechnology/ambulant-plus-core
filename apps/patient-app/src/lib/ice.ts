'use client';

export function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
  ];

  const url = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const credential = process.env.NEXT_PUBLIC_TURN_PASSWORD?.trim();

  if (url) {
    const urls = url
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (urls.length > 0) {
      servers.push({
        urls,
        ...(username ? { username } : {}),
        ...(credential ? { credential } : {}),
      });
    }
  }

  return servers;
}