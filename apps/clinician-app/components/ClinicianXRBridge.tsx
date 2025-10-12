'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import type { Room, DataPacket_Kind } from 'livekit-client';
import { isXrSignal, type XrSignal } from '@runtime/xrPayload';

type Props = {
  roomId?: string | null;
  onChange?: (enabled: boolean) => void; // bubble up to parent (to show overlay)
  showControls?: boolean;                // minimal inline controls (optional)
};

export default function ClinicianXRBridge({ roomId, onChange, showControls }: Props) {
  const room = useRoomContext(); // requires to be rendered inside <LiveKitRoom>
  const [enabled, setEnabled] = useState(false);
  const roomRef = useRef<Room | null>(null);

  // --- helpers
  const publish = useCallback(async (value: boolean) => {
    const r = roomRef.current;
    if (!r) return;
    const payload: XrSignal = { type: 'xr', value, who: 'clinician', ts: Date.now() };
    try {
      // reliable so late-joiners get it via participant metadata replay? We'll send data channel (reliable)
      await r.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true, topic: 'xr' as any as string } // topic is optional; helps filtering on newer SDKs
      );
    } catch (e) {
      // best-effort; don't throw
      console.warn('XR publish failed', e);
    }
  }, []);

  const setBoth = useCallback((value: boolean) => {
    setEnabled(value);
    onChange?.(value);
    publish(value);
  }, [onChange, publish]);

  // --- hook room
  useEffect(() => {
    if (!room) return;
    roomRef.current = room;

    const handler = (payload: Uint8Array, participant: any, _kind: DataPacket_Kind, _topic?: string) => {
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

  // --- listen for global UI toggle events from the page header
  useEffect(() => {
    const onUiEvent = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      const value = !!ce.detail;
      setBoth(value);
    };
    window.addEventListener('xr:set', onUiEvent as EventListener);
    return () => window.removeEventListener('xr:set', onUiEvent as EventListener);
  }, [setBoth]);

  // keep overlay off when leaving room
  useEffect(() => {
    if (!roomId) { setEnabled(false); onChange?.(false); }
  }, [roomId, onChange]);

  if (!showControls) return null;

  return (
    <div className="absolute right-2 bottom-2 z-10 flex gap-2">
      <button
        className={`px-2 py-1 rounded text-xs border ${enabled ? 'bg-gray-900 text-white' : 'bg-white'}`}
        onClick={() => setBoth(!enabled)}
        title="Toggle XR overlay for everyone in room"
      >
        {enabled ? 'XR ON' : 'XR OFF'}
      </button>
      {enabled && (
        <button
          className="px-2 py-1 rounded text-xs border bg-white"
          onClick={() => setBoth(false)}
          title="Exit XR (broadcast to room)"
        >
          Exit XR
        </button>
      )}
    </div>
  );
}
