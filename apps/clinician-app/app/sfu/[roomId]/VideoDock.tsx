// apps/clinician-app/app/sfu/[roomId]/VideoDock.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { CaptionEvent } from '@ambulant/rtc';
import type { Room, RemoteParticipant, Participant } from 'livekit-client';
import { RoomEvent } from 'livekit-client';

import { Card, Badge, Icon, IconBtn } from '@/components/ui';
import CaptionOverlay from '@/src/components/rtc/CaptionOverlay';
import CaptionsPanel from '@/src/components/rtc/CaptionsPanel';
import TrainingParticipantGrid from './TrainingParticipantGrid';

type Vitals = {
  ts?: number;
  hr?: number;
  spo2?: number;
  tempC?: number;
  rr?: number;
  sys?: number;
  dia?: number;

  // support both names; clinician UI displays mmol/L
  glu?: number; // expected mmol/L
  glucose?: number; // may arrive as mg/dL from connected device sources
};

function num2(x?: number) {
  return typeof x === 'number' && Number.isFinite(x) ? Number(x).toFixed(2) : '—';
}

function fmtBP(sys?: number, dia?: number) {
  const ok = Number.isFinite(sys as number) && Number.isFinite(dia as number);
  return ok ? `${Math.round(sys!)} / ${Math.round(dia!)} mmHg` : '—/— mmHg';
}

function fmtWithUnit(x: number | undefined, unit: string) {
  const has = typeof x === 'number' && Number.isFinite(x);
  const base = has ? num2(x) : '—';
  return `${base} ${unit}`;
}

function toGluMmol(vitals: Vitals): number | undefined {
  const raw = vitals.glu ?? vitals.glucose;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;

  // heuristic: if it looks like mg/dL (common 60–220), convert to mmol/L
  if (raw > 25) return raw / 18;
  return raw;
}

type VideoDockProps = {
  room: Room | null;
  vitals: Vitals;
  dense: boolean;
  presentation: boolean;
  patientName: string;

  handRaised?: boolean;

  micOn: boolean;
  camOn: boolean;
  showOverlay: boolean;
  showVitals: boolean;
  showVitalsOverlay: boolean;
  captionsOn: boolean;
  isRecording: boolean;
  xrEnabled: boolean;
  captionLines?: CaptionEvent[];

  pip: { x: number; y: number };

  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleOverlay: (next: boolean) => void;
  onToggleVitals: (next: boolean) => void;
  onToggleVitalsOverlay: (next: boolean) => void;
  onToggleCaptions: (next: boolean) => void;
  onToggleRecording: (next: boolean) => void;
  onToggleXr: (next: boolean) => void;

  onEnterPresentation: () => void;
  onExitPresentation: () => void;
};

function firstRemote(r: Room): RemoteParticipant | undefined {
  const anyRoom = r as unknown as {
    getParticipants?: () => unknown;
    remoteParticipants?: Map<string, RemoteParticipant>;
    participants?: Map<string, RemoteParticipant>;
  };

  if (typeof anyRoom.getParticipants === 'function') {
    const arr = anyRoom.getParticipants();
    if (Array.isArray(arr) && arr.length) return arr[0] as RemoteParticipant;
  }

  const maps = [anyRoom.remoteParticipants, anyRoom.participants];
  for (const m of maps) {
    if (m && typeof m.values === 'function') {
      const it = m.values();
      const n = it.next();
      if (!n.done) return n.value as RemoteParticipant;
    }
  }
  return undefined;
}

export default function VideoDock({
  room,
  vitals,
  dense,
  presentation,
  patientName,
  handRaised = false,
  micOn,
  camOn,
  showOverlay,
  showVitals,
  showVitalsOverlay,
  captionsOn,
  isRecording,
  xrEnabled,
  captionLines = [],
  pip,
  onToggleMic,
  onToggleCam,
  onToggleOverlay,
  onToggleVitals,
  onToggleVitalsOverlay,
  onToggleCaptions,
  onToggleRecording,
  onToggleXr,
  onEnterPresentation,
  onExitPresentation,
}: VideoDockProps) {
  const videoCardRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioSinkRef = useRef<HTMLAudioElement | null>(null);

  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  // PiP drag/lock
  const [videoFloating, setVideoFloating] = useState(false);
  const [videoFloatLocked, setVideoFloatLocked] = useState(true);
  const [videoPos, setVideoPos] = useState<{ xPct: number; yPct: number }>({ xPct: 10, yPct: 10 });

  const draggingRef = useRef<{ active: boolean; grabDx: number; grabDy: number } | null>(null);

  const [showVControls, setShowVControls] = useState(false);
  const touchTimerRef = useRef<number | null>(null);
  const hoverOpacity = showVControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  const touchKick = () => {
    setShowVControls(true);
    if (touchTimerRef.current && typeof window !== 'undefined') window.clearTimeout(touchTimerRef.current);
    if (typeof window !== 'undefined') {
      touchTimerRef.current = window.setTimeout(() => setShowVControls(false), 2500);
    }
  };

  const toggleFloatLock = () => {
    if (draggingRef.current) draggingRef.current.active = false;
    setVideoFloatLocked((prev) => {
      const next = !prev;
      setVideoFloating(!next);
      return next;
    });
  };

  const startDragPip = (clientX: number, clientY: number) => {
    if (videoFloatLocked) return;
    const host = videoCardRef.current;
    const pipEl = localVideoRef.current;
    if (!host || !pipEl) return;

    setVideoFloating(true);

    const pipRect = pipEl.getBoundingClientRect();
    draggingRef.current = {
      active: true,
      grabDx: clientX - pipRect.left,
      grabDy: clientY - pipRect.top,
    };
  };

  const moveDragPip = (clientX: number, clientY: number) => {
    if (!draggingRef.current?.active || videoFloatLocked) return;

    const host = videoCardRef.current;
    const pipEl = localVideoRef.current;
    if (!host || !pipEl) return;

    const hostRect = host.getBoundingClientRect();
    const pipRect = pipEl.getBoundingClientRect();

    const xPxRaw = clientX - hostRect.left - draggingRef.current.grabDx;
    const yPxRaw = clientY - hostRect.top - draggingRef.current.grabDy;

    const xPx = Math.max(0, Math.min(hostRect.width - pipRect.width, xPxRaw));
    const yPx = Math.max(0, Math.min(hostRect.height - pipRect.height, yPxRaw));

    const xPct = (xPx / hostRect.width) * 100;
    const yPct = (yPx / hostRect.height) * 100;

    setVideoPos({ xPct, yPct });
  };

  const endDragPip = () => {
    if (draggingRef.current) draggingRef.current.active = false;
  };

  useEffect(() => {
    const up = () => endDragPip();
    const leave = () => endDragPip();
    if (typeof window === 'undefined') return;

    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    window.addEventListener('mouseleave', leave);

    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
      window.removeEventListener('mouseleave', leave);
    };
  }, []);

  // Attach tracks + active speakers
  useEffect(() => {
    if (!room) return;

    const attachTracks = () => {
      const rp = firstRemote(room);

      if (rp) {
        const rvpub = [...rp.videoTrackPublications.values()].find((p) => p.isSubscribed && p.videoTrack);
        if (rvpub && remoteVideoRef.current) rvpub.videoTrack?.attach(remoteVideoRef.current);

        const rapub = [...rp.audioTrackPublications.values()].find((p) => p.isSubscribed && p.audioTrack);
        if (rapub && audioSinkRef.current) rapub.audioTrack?.attach(audioSinkRef.current);
      }

      const localPubV = [...room.localParticipant.videoTrackPublications.values()].find((p) => p.track);
      if (localPubV && localVideoRef.current) localPubV.videoTrack?.attach(localVideoRef.current);
    };

    attachTracks();

    const handleActiveSpeakers = (speakers: Participant[]) => {
      const someoneRemoteSpeaking = speakers.some((p) => p.sid !== room.localParticipant.sid);
      setRemoteSpeaking(someoneRemoteSpeaking);
    };

    const rerender = () => attachTracks();

    room
      .on(RoomEvent.TrackSubscribed, rerender)
      .on(RoomEvent.TrackUnsubscribed, rerender)
      .on(RoomEvent.LocalTrackPublished, rerender)
      .on(RoomEvent.ParticipantConnected, rerender)
      .on(RoomEvent.ParticipantDisconnected, rerender)
      .on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);

    return () => {
      room
        .off(RoomEvent.TrackSubscribed, rerender)
        .off(RoomEvent.TrackUnsubscribed, rerender)
        .off(RoomEvent.LocalTrackPublished, rerender)
        .off(RoomEvent.ParticipantConnected, rerender)
        .off(RoomEvent.ParticipantDisconnected, rerender)
        .off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    };
  }, [room]);

  const handleDoubleClick = () => {
    if (presentation) onExitPresentation();
    else onEnterPresentation();
  };

  return (
    <Card title={`Consultation — ${patientName}`} dense={dense} gradient>
      <div
        ref={videoCardRef}
        role="region"
        aria-label={`Video consultation with ${patientName}`}
        aria-live="polite"
        onDoubleClick={handleDoubleClick}
        onTouchStart={() => touchKick()}
        className={`group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-inner ${
          presentation ? 'cursor-zoom-out' : 'cursor-default'
        }`}
      >
        <TrainingParticipantGrid room={room} />

        <CaptionOverlay lines={captionLines} enabled={captionsOn} />

        {handRaised ? (
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/95 px-3 py-1.5 text-[11px] font-semibold text-amber-900 shadow-lg backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Patient hand raised
          </div>
        ) : null}

        {/* Controls bar */}
        <div
          className={`absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/78 px-2.5 py-2 shadow-2xl backdrop-blur-xl ${hoverOpacity} transition-opacity duration-200`}
          data-no-drag="true"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <IconBtn active={micOn} title={micOn ? 'Mute mic' : 'Unmute mic'} onClick={onToggleMic}>
            <Icon name={(!micOn) ? "mic-off" : "mic"} />
          </IconBtn>

          <IconBtn active={camOn} title={camOn ? 'Stop camera' : 'Start camera'} onClick={onToggleCam}>
            <Icon name={(!camOn) ? "video-off" : "video"} />
          </IconBtn>

          <IconBtn active={showVitals} title={showVitals ? 'Hide vitals' : 'Show vitals'} onClick={() => onToggleVitals(!showVitals)}>
            <Icon name="heart" />
          </IconBtn>

          <IconBtn active={captionsOn} title={captionsOn ? 'Disable captions' : 'Enable captions'} onClick={() => onToggleCaptions(!captionsOn)}>
            <Icon name="cc" />
          </IconBtn>

          <button
            type="button"
            onClick={() => setTranscriptOpen(true)}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={captionLines.length === 0}
            title="Open full transcript"
          >
            Transcript
          </button>

          <IconBtn active={showOverlay} title={showOverlay ? 'Disable overlay' : 'Enable overlay'} onClick={() => onToggleOverlay(!showOverlay)}>
            <Icon name="layers" />
          </IconBtn>

          <IconBtn active={showVitalsOverlay}
            title={showVitalsOverlay ? 'Hide vitals stream overlay' : 'Show vitals stream overlay'}
            onClick={() => onToggleVitalsOverlay(!showVitalsOverlay)}
          >
            <Icon name="vitals-overlay" />
          </IconBtn>

          <IconBtn active={isRecording} title={isRecording ? 'Stop recording' : 'Start recording'} onClick={() => onToggleRecording(!isRecording)}>
            <Icon name="rec" />
          </IconBtn>

          <IconBtn active={xrEnabled} title={xrEnabled ? 'Disable XR broadcast' : 'Enable XR broadcast'} onClick={() => onToggleXr(!xrEnabled)}>
            <Icon name="xr" />
          </IconBtn>

          <IconBtn active={!videoFloatLocked}
            title={videoFloatLocked ? 'Unlock picture-in-picture' : 'Lock picture-in-picture'}
            onClick={toggleFloatLock}
          >
            <Icon name={videoFloatLocked ? 'lock' : 'unlock'} />
          </IconBtn>
        </div>

        {/* Transparent vitals stream overlay */}
        {showVitalsOverlay && <VitalsStreamOverlay vitals={vitals} />}

        {/* Badges */}
        <div className="pointer-events-none absolute right-4 top-4 flex flex-wrap justify-end gap-1.5 drop-shadow-sm">
          <Badge label="Vitals" active={showVitals} color="emerald" />
          <Badge label="Captions" active={captionsOn} color="indigo" />
          <Badge label="Overlay" active={showOverlay} color="sky" />
          <Badge label="Stream" active={showVitalsOverlay} color="emerald" />
          {isRecording && <Badge label="● Recording" active color="red" />}
          <Badge label="XR" active={xrEnabled} color="gray" />
        </div>
      </div>
      {transcriptOpen ? (
        <div className="fixed inset-0 z-[70] bg-gray-950/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true">
          <div className="ml-auto flex h-full w-full max-w-xl flex-col rounded-[28px] border border-white/80 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Consultation transcript</div>
                <div className="text-xs text-gray-500">Live caption transcript. Review before filing into the clinical note.</div>
              </div>
              <button
                type="button"
                onClick={() => setTranscriptOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CaptionsPanel selfLabel="Clinician" peerLabel={patientName || 'Patient'} rows={captionLines} />
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function VitalsStreamOverlay({ vitals }: { vitals: Vitals }) {
  const gluMmol = toGluMmol(vitals);

  const rows: { key: string; label: string; value: string }[] = [
    { key: 'BP', label: 'BP', value: fmtBP(vitals.sys, vitals.dia) },
    { key: 'SpO2', label: 'SpO₂', value: fmtWithUnit(vitals.spo2, '%') },
    { key: 'Temp', label: 'Temp', value: fmtWithUnit(vitals.tempC, '°C') },
    { key: 'HR', label: 'HR', value: fmtWithUnit(vitals.hr, 'bpm') },
    { key: 'RR', label: 'RR', value: fmtWithUnit(vitals.rr, '/min') },
    { key: 'Glu', label: 'Glu', value: fmtWithUnit(gluMmol, 'mmol/L') },
  ];

  return (
    <div className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2 select-none" aria-hidden="true">
      <div className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-slate-950/48 p-2.5 text-white shadow-xl backdrop-blur-md">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/55">{r.label}</span>
            <span className="text-xs font-semibold tracking-[-0.01em]">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}