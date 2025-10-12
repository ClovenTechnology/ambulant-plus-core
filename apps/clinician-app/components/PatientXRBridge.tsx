'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import type { Room, DataPacket_Kind } from 'livekit-client';
import { isXrSignal, type XrSignal } from '@runtime/xrPayload';

type Props = {
  onChange?: (enabled: boolean) => void;   // parent toggles overlay
  showExit?: boolean;                       // show the mini Exit XR action
};

export default function PatientXRBridge({ onChange, showExit }: Props) {
  const room = useRoomContext();
  const roomRef = useRef<Room | null>(null);
  const [enabled, setEnabled] = useState(false);

  const publish = useCallback(async (value: boolean) => {
    const r = roomRef.current;
    if (!r) return;
    const payload: XrSignal = { type: 'xr', value, who: 'patient', ts: Date.now() };
    try {
      await r.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true, topic: 'xr' as any as string }
      );
    } catch (e) {
      console.warn('XR publish failed (patient)', e);
    }
  }, []);

  // listen
  useEffect(() => {
    if (!room) return;
    roomRef.current = room;

    const handler = (payload: Uint8Array, _p: any, _k: DataPacket_Kind) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (isXrSignal(msg)) {
          setEnabled(msg.value);
          onChange?.(msg.value);
        }
      } catch {}
    };

    room.on('dataReceived', handler);
    return () => {
      room.off('dataReceived', handler);
      roomRef.current = null;
    };
  }, [room, onChange]);

  // exit action (optimistic hide + broadcast false)
  const exit = () => {
    setEnabled(false);
    onChange?.(false);
    publish(false);
  };

  if (!showExit || !enabled) return null;

  return (
    <div className="absolute right-2 bottom-2 z-10">
      <button
        className="px-2 py-1 rounded text-xs border bg-white"
        onClick={exit}
        title="Exit XR overlay"
      >
        Exit XR
      </button>
    </div>
  );
}
