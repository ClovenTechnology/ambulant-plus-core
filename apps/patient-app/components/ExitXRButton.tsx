'use client';
import { Room, DataPacket_Kind } from 'livekit-client';
import { useState } from 'react';

export default function ExitXRButton({
  roomRef,
  onLocalToggle,
  className = 'px-2 py-1 border rounded text-xs'
}: {
  roomRef: React.RefObject<Room | null>;
  onLocalToggle?: () => void;   // e.g. hide local overlay immediately
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const exitXR = async () => {
    if (!roomRef.current) { onLocalToggle?.(); return; }
    setBusy(true);
    try {
      const payload = { type: 'xr', value: false };
      await roomRef.current.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        DataPacket_Kind.RELIABLE,
        'control'
      );
      onLocalToggle?.(); // optimistic local hide
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={exitXR} disabled={busy} className={className} title="Exit XR overlay">
      {busy ? 'Exiting…' : 'Exit XR'}
    </button>
  );
}
