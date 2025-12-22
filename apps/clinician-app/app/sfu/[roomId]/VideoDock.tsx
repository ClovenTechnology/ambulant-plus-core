'use client';

import { useEffect, useRef, useState } from 'react';
import type { Room, RemoteParticipant, Participant } from 'livekit-client';
import { RoomEvent } from 'livekit-client';

import { Card, Badge, Icon, IconBtn } from '@/components/ui';

type Vitals = {
  ts?: number;
  hr?: number;
  spo2?: number;
  tempC?: number;
  rr?: number;
  sys?: number;
  dia?: number;
  glu?: number; // normalized blood glucose
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

type VideoDockProps = {
  room: Room | null;
  vitals: Vitals;
  dense: boolean;
  presentation: boolean;
  patientName: string;

  micOn: boolean;
  camOn: boolean;
  showOverlay: boolean;
  showVitals: boolean;
  showVitalsOverlay: boolean;
  captionsOn: boolean;
  isRecording: boolean;
  xrEnabled: boolean;

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
  const anyRoom = r as any;
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
  micOn,
  camOn,
  showOverlay,
  showVitals,
  showVitalsOverlay,
  captionsOn,
  isRecording,
  xrEnabled,
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

  const [videoFloating, setVideoFloating] = useState(false);
  const [videoFloatLocked, setVideoFloatLocked] = useState(true);
  const [videoPos, setVideoPos] = useState<{ xPct: number; yPct: number }>({
    xPct: 10,
    yPct: 10,
  });
  const draggingRef = useRef<{ active: boolean; dx: number; dy: number } | null>(null);

  const [showVControls, setShowVControls] = useState(false);
  const touchTimerRef = useRef<number | null>(null);
  const hoverOpacity = showVControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  const touchKick = () => {
    setShowVControls(true);
    if (touchTimerRef.current && typeof window !== 'undefined')
      window.clearTimeout(touchTimerRef.current);
    if (typeof window !== 'undefined') {
      touchTimerRef.current = window.setTimeout(() => setShowVControls(false), 2500);
    }
  };

  const toggleFloatLock = () => {
    if (draggingRef.current) draggingRef.current.active = false;
    setVideoFloatLocked((prev) => {
      const next = !prev;
      if (next) setVideoFloating(false);
      else setVideoFloating(true);
      return next;
    });
  };

  const startDragVideo = (clientX: number, clientY: number) => {
    if (videoFloatLocked) return;
    setVideoFloating(true);
    draggingRef.current = { active: true, dx: clientX, dy: clientY };
  };
  const moveDragVideo = (clientX: number, clientY: number) => {
    if (!draggingRef.current?.active || videoFloatLocked) return;
    const vw = Math.max(
      document.documentElement.clientWidth,
      window.innerWidth || 0
    );
    const vh = Math.max(
      document.documentElement.clientHeight,
      window.innerHeight || 0
    );
    const w = Math.min(vw, 960);
    const h = (w * 9) / 16;
    const x = ((clientX - w * 0.5) / vw) * 100;
    const y = ((clientY - h * 0.5) / vh) * 100;
    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));
    setVideoPos({ xPct: clamp(x, 0, 100), yPct: clamp(y, 0, 100) });
  };
  const endDragVideo = () => {
    if (draggingRef.current) draggingRef.current.active = false;
  };

  useEffect(() => {
    const up = () => endDragVideo();
    const leave = () => endDragVideo();
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
        const rvpub = [...rp.videoTrackPublications.values()].find(
          (p) => p.isSubscribed && p.videoTrack
        );
        if (rvpub && remoteVideoRef.current)
          rvpub.videoTrack?.attach(remoteVideoRef.current);
        const rapub = [...rp.audioTrackPublications.values()].find(
          (p) => p.isSubscribed && p.audioTrack
        );
        if (rapub && audioSinkRef.current)
          rapub.audioTrack?.attach(audioSinkRef.current);
      }
      const localPubV = [
        ...room.localParticipant.videoTrackPublications.values(),
      ].find((p) => p.track);
      if (localPubV && localVideoRef.current)
        localPubV.videoTrack?.attach(localVideoRef.current);
    };

    attachTracks();

    const handleTrackSub = () => attachTracks();
    const handleTrackUnsub = () => attachTracks();
    const handleLocalPub = () => attachTracks();
    const handleParticipantConnected = () => attachTracks();
    const handleParticipantDisconnected = () => attachTracks();

    const handleActiveSpeakers = (speakers: Participant[]) => {
      const someoneRemoteSpeaking = speakers.some(
        (p) => p.sid !== room.localParticipant.sid
      );
      setRemoteSpeaking(someoneRemoteSpeaking);
    };

    room
      .on(RoomEvent.TrackSubscribed, handleTrackSub)
      .on(RoomEvent.TrackUnsubscribed, handleTrackUnsub)
      .on(RoomEvent.LocalTrackPublished, handleLocalPub)
      .on(RoomEvent.ParticipantConnected, handleParticipantConnected)
      .on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
      .on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);

    return () => {
      room
        .off(RoomEvent.TrackSubscribed, handleTrackSub)
        .off(RoomEvent.TrackUnsubscribed, handleTrackUnsub)
        .off(RoomEvent.LocalTrackPublished, handleLocalPub)
        .off(RoomEvent.ParticipantConnected, handleParticipantConnected)
        .off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
        .off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    };
  }, [room]);

  const handleDoubleClick = () => {
    if (presentation) onExitPresentation();
    else onEnterPresentation();
  };

  return (
    <Card
      title={`Consultation — ${patientName}`}
      dense={dense}
      gradient
    >
      <div
        ref={videoCardRef}
        role="region"
        aria-label={`Video consultation with ${patientName}`}
        aria-live="polite"
        onDoubleClick={handleDoubleClick}
        className={`relative aspect-video w-full rounded-lg overflow-hidden bg-black ring-1 ring-gray-200 group ${
          presentation ? 'cursor-zoom-out' : 'cursor-default'
        }`}
        onMouseDown={(e) => startDragVideo(e.clientX, e.clientY)}
        onMouseMove={(e) => moveDragVideo(e.clientX, e.clientY)}
        onMouseUp={endDragVideo}
        onTouchStart={(e) => {
          const t = e.touches[0];
          startDragVideo(t.clientX, t.clientY);
          touchKick();
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          moveDragVideo(t.clientX, t.clientY);
        }}
      >
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ring-1 ring-black/10 ${
            remoteSpeaking
              ? 'outline outline-4 outline-emerald-400 outline-offset-0 transition-[outline] duration-200'
              : ''
          }`}
        />
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute rounded border border-white/80 shadow-lg object-cover w-40 h-28"
          style={{
            left: `${videoFloating ? videoPos.xPct : pip.x}%`,
            top: `${videoFloating ? videoPos.yPct : pip.y}%`,
          }}
          title="Local preview"
        />
        <audio ref={audioSinkRef} autoPlay />

        {/* Controls bar */}
        <div
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-white/85 backdrop-blur rounded-full px-2 py-2 shadow ${hoverOpacity} transition-opacity duration-200`}
        >
          <IconBtn
            onClick={onToggleMic}
            aria-label={micOn ? 'Mute mic' : 'Unmute mic'}
            aria-pressed={micOn}
            role="switch"
            aria-checked={micOn}
          >
            <Icon name="mic" toggledName="mic-off" toggled={!micOn} />
          </IconBtn>
          <IconBtn
            onClick={onToggleCam}
            aria-label={camOn ? 'Stop camera' : 'Start camera'}
            aria-pressed={camOn}
            role="switch"
            aria-checked={camOn}
          >
            <Icon name="video" toggledName="video-off" toggled={!camOn} />
          </IconBtn>
          <IconBtn
            title={showVitals ? 'Hide vitals' : 'Show vitals'}
            aria-pressed={showVitals}
            onClick={() => onToggleVitals(!showVitals)}
          >
            <Icon name="heart" />
          </IconBtn>
          <IconBtn
            title={captionsOn ? 'Disable captions' : 'Enable captions'}
            aria-pressed={captionsOn}
            onClick={() => onToggleCaptions(!captionsOn)}
          >
            <Icon name="cc" />
          </IconBtn>
          <IconBtn
            title={showOverlay ? 'Disable overlay' : 'Enable overlay'}
            aria-pressed={showOverlay}
            onClick={() => onToggleOverlay(!showOverlay)}
          >
            <Icon name="layers" />
          </IconBtn>
          <IconBtn
            title={
              showVitalsOverlay
                ? 'Hide vitals stream overlay'
                : 'Show vitals stream overlay'
            }
            aria-pressed={showVitalsOverlay}
            onClick={() => onToggleVitalsOverlay(!showVitalsOverlay)}
          >
            <Icon name="vitals-overlay" />
          </IconBtn>
          <IconBtn
            title={isRecording ? 'Stop recording' : 'Start recording'}
            aria-pressed={isRecording}
            onClick={() => onToggleRecording(!isRecording)}
          >
            <Icon name="rec" />
          </IconBtn>
          <IconBtn
            title={xrEnabled ? 'Disable XR broadcast' : 'Enable XR broadcast'}
            aria-pressed={xrEnabled}
            onClick={() => onToggleXr(!xrEnabled)}
          >
            <Icon name="xr" />
          </IconBtn>
          <IconBtn
            title={
              videoFloatLocked
                ? 'Unlock picture-in-picture'
                : 'Lock picture-in-picture'
            }
            aria-pressed={!videoFloatLocked}
            onClick={toggleFloatLock}
          >
            <Icon name={videoFloatLocked ? 'lock' : 'unlock'} />
          </IconBtn>
        </div>

        {/* Transparent vitals stream overlay */}
        {showVitalsOverlay && <VitalsStreamOverlay vitals={vitals} />}

        {/* Badges */}
        <div className="absolute top-3 right-3 flex gap-1 drop-shadow-sm pointer-events-none">
          <Badge label="Vitals" active={showVitals} color="emerald" />
          <Badge label="Captions" active={captionsOn} color="indigo" />
          <Badge label="Overlay" active={showOverlay} color="sky" />
          <Badge label="Stream" active={showVitalsOverlay} color="emerald" />
          {isRecording && <Badge label="● Recording" active color="red" />}
          <Badge label="XR" active={xrEnabled} color="gray" />
        </div>
      </div>
    </Card>
  );
}

function VitalsStreamOverlay({ vitals }: { vitals: Vitals }) {
  const rows: { key: string; label: string; value: string }[] = [
    { key: 'BP', label: 'BP', value: fmtBP(vitals.sys, vitals.dia) },
    {
      key: 'SpO2',
      label: 'SpO₂',
      value: fmtWithUnit(vitals.spo2, '%'),
    },
    {
      key: 'Temp',
      label: 'Temp',
      value: fmtWithUnit(vitals.tempC, '°C'),
    },
    {
      key: 'HR',
      label: 'HR',
      value: fmtWithUnit(vitals.hr, 'bpm'),
    },
    {
      key: 'RR',
      label: 'RR',
      value: fmtWithUnit(vitals.rr, '/min'),
    },
    {
      key: 'Glu',
      label: 'Glu',
      value: fmtWithUnit(vitals.glu, 'mmol/L'),
    },
  ];

  return (
    <div
      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none select-none"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-1 text-white drop-shadow">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="text-[11px] opacity-90">{r.label}</span>
            <span className="text-sm font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
