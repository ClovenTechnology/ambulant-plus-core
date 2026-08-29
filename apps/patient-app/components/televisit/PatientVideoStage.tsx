'use client';

import { useState, type RefObject } from 'react';
import type { Room } from 'livekit-client';
import type { CaptionEvent } from '@ambulant/rtc';

import HoloVitalsOverlay from '@/components/HoloVitalsOverlay';
import { Badge, IconBtn } from '@/components/ui';
import PatientTrainingParticipantGrid from './PatientTrainingParticipantGrid';

type HudVital = { t: string; type: string; value: number; unit?: string };
type HudDevice = { id: string; vendor?: string; model?: string; lastSeenAt?: string };

type Props = {
  floating?: boolean;
  trainingRoom?: Room | null;
  presentation: boolean;
  activeSpeaking: boolean;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  audioSinkRef: RefObject<HTMLAudioElement | null>;
  videoCardRef?: RefObject<HTMLDivElement | null>;
  micOn: boolean;
  camOn: boolean;
  showVitals: boolean;
  captionsOn: boolean;
  showOverlay: boolean;
  isRecording: boolean;
  screenOn: boolean;
  handRaised: boolean;
  blurOn: boolean;
  elapsed?: string;
  pip: { x: number; y: number };
  floatingPos?: { xPct: number; yPct: number };
  floatingLocked?: boolean;
  showControls?: boolean;
  hudVitals?: HudVital[];
  hudDevices?: HudDevice[];
  captionLines?: CaptionEvent[];
  onKickTouchUi?: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleVitals: () => void;
  onToggleCaptions: () => void;
  onToggleOverlay: () => void;
  onToggleRecording: () => void;
  onToggleScreenShare: () => void;
  onToggleHand: () => void;
  onToggleBlur: () => void;
  onTogglePresentation: () => void;
  onToggleFloatLock?: () => void;
  onDock?: () => void;
  onStartDrag?: (clientX: number, clientY: number) => void;
  onMoveDrag?: (clientX: number, clientY: number) => void;
  onEndDrag?: () => void;
};

export default function PatientVideoStage({
  floating = false,
  trainingRoom = null,
  presentation,
  activeSpeaking,
  remoteVideoRef,
  localVideoRef,
  audioSinkRef,
  videoCardRef,
  micOn,
  camOn,
  showVitals,
  captionsOn,
  showOverlay,
  isRecording,
  screenOn,
  handRaised,
  blurOn,
  elapsed,
  pip,
  floatingPos,
  floatingLocked,
  showControls = false,
  hudVitals = [],
  hudDevices = [],
  captionLines = [],
  onKickTouchUi,
  onToggleMic,
  onToggleCam,
  onToggleVitals,
  onToggleCaptions,
  onToggleOverlay,
  onToggleRecording,
  onToggleScreenShare,
  onToggleHand,
  onToggleBlur,
  onTogglePresentation,
  onToggleFloatLock,
  onDock,
  onStartDrag,
  onMoveDrag,
  onEndDrag,
}: Props) {
  const stageShell = floating
    ? 'fixed z-50 overflow-hidden rounded-2xl bg-black shadow-2xl'
    : 'relative overflow-hidden rounded-2xl bg-black';

  const ringTone = activeSpeaking ? 'ring-2 ring-emerald-400' : 'ring-1 ring-slate-200';

  const style = floating
    ? {
        left: `${floatingPos?.xPct ?? 10}%`,
        top: `${floatingPos?.yPct ?? 10}%`,
        width: 'min(90vw, 960px)',
        aspectRatio: '16 / 9',
        transform: 'translate(-10%, -10%)',
        cursor: floatingLocked ? 'not-allowed' : 'grab',
      }
    : undefined;

  const controlsOpacity = showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const visibleCaptions = captionLines.slice(-3);

  const setVideoCardNode = (node: HTMLDivElement | null) => {
    if (!videoCardRef) return;
    (videoCardRef as { current: HTMLDivElement | null }).current = node;
  };

  const setRemoteVideoNode = (node: HTMLVideoElement | null) => {
    (remoteVideoRef as { current: HTMLVideoElement | null }).current = node;
  };

  const setLocalVideoNode = (node: HTMLVideoElement | null) => {
    (localVideoRef as { current: HTMLVideoElement | null }).current = node;
  };

  const setAudioSinkNode = (node: HTMLAudioElement | null) => {
    (audioSinkRef as { current: HTMLAudioElement | null }).current = node;
  };

  return (
    <>
      <div
        ref={setVideoCardNode}
        className={`${stageShell} ${ringTone} group aspect-video w-full`}
        style={style}
        title={floatingLocked ? 'Floating locked' : 'Drag when unlocked'}
        onDoubleClick={onTogglePresentation}
        onMouseDown={(e) => {
          if (floating && !floatingLocked) onStartDrag?.(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          if (floating && !floatingLocked) onMoveDrag?.(e.clientX, e.clientY);
        }}
        onMouseUp={() => {
          if (floating) onEndDrag?.();
        }}
        onTouchStart={(e) => {
          onKickTouchUi?.();
          if (floating && !floatingLocked) {
            const t = e.touches[0];
            if (t) onStartDrag?.(t.clientX, t.clientY);
          }
        }}
        onTouchMove={(e) => {
          if (floating && !floatingLocked) {
            const t = e.touches[0];
            if (t) onMoveDrag?.(t.clientX, t.clientY);
          }
        }}
        onTouchEnd={() => {
          if (floating) onEndDrag?.();
        }}
      >
        {onToggleFloatLock ? (
          <div className={`absolute left-3 top-3 z-10 ${controlsOpacity} transition-opacity duration-200`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFloatLock();
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 shadow ring-1 ring-black/10"
              title={floatingLocked ? 'Unlock floating' : 'Lock floating'}
            >
              <span className={`text-base ${floatingLocked ? 'text-emerald-600' : 'text-rose-600'}`}>
                {floatingLocked ? '🔒' : '🔓'}
              </span>
            </button>
          </div>
        ) : null}

        {trainingRoom ? (
          <PatientTrainingParticipantGrid room={trainingRoom} />
        ) : (
          <>
            <video
              ref={setRemoteVideoNode}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
            <video
              ref={setLocalVideoNode}
              autoPlay
              playsInline
              muted
              className="absolute h-28 w-40 rounded-xl border border-white/80 object-cover shadow-lg"
              style={{ left: `${pip.x}%`, top: `${pip.y}%` }}
              title="Local preview"
            />
            <audio ref={setAudioSinkNode} autoPlay />
          </>
        )}


        {captionsOn && visibleCaptions.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-20 z-20 flex flex-col items-center gap-1 sm:bottom-24">
            {visibleCaptions.map((line) => (
              <div
                key={[line.speakerIdentity || line.speakerDisplay, line.sequence, line.timestamp].join(':')}
                className="max-w-[94%] rounded-2xl bg-black/75 px-3 py-2 text-center text-xs font-medium leading-snug text-white shadow-lg backdrop-blur sm:text-sm"
              >
                <span className="mr-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/80">
                  {line.speakerDisplay || line.speakerName || 'Speaker'}
                </span>
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="pointer-events-none absolute right-3 top-3 z-10 flex gap-1">
          <Badge className={showVitals ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}>
            Vitals
          </Badge>
          <Badge className={captionsOn ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600'}>
            Captions
          </Badge>
          <Badge className={showOverlay ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-600'}>
            Overlay
          </Badge>
          {isRecording ? (
            <Badge className="border-rose-200 bg-rose-50 text-rose-800">● Recording</Badge>
          ) : null}
        </div>

        {handRaised ? (
          <span className="absolute left-14 top-3 z-10 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white shadow">
            ✋ Raised
          </span>
        ) : null}

        {elapsed ? (
          <div className="absolute bottom-3 left-3 z-10 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            Session {elapsed}
          </div>
        ) : null}

        {showOverlay ? (
          <HoloVitalsOverlay
            visible={showOverlay}
            vitals={hudVitals}
            devices={hudDevices}
            corner="tr"
          />
        ) : null}

        <div
          className={`absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full bg-white/85 px-2 py-2 shadow backdrop-blur ${controlsOpacity} transition-opacity duration-200`}
        >
          <IconBtn onClick={onToggleMic} aria-label={micOn ? 'Mute mic' : 'Unmute mic'} aria-pressed={micOn}>
            <span className="text-base">{micOn ? '🎙️' : '🔇'}</span>
          </IconBtn>

          <IconBtn onClick={onToggleCam} aria-label={camOn ? 'Stop camera' : 'Start camera'} aria-pressed={camOn}>
            <span className="text-base">{camOn ? '📷' : '🚫'}</span>
          </IconBtn>

          <IconBtn onClick={onToggleVitals} title={showVitals ? 'Hide vitals' : 'Show vitals'}>
            <span className="text-base">❤️</span>
          </IconBtn>

          <IconBtn onClick={onToggleCaptions} title={captionsOn ? 'Disable captions' : 'Enable captions'}>
            <span className="text-base">CC</span>
          </IconBtn>

          <button
            type="button"
            onClick={() => setTranscriptOpen(true)}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={captionLines.length === 0}
            title="Open full transcript"
          >
            Transcript
          </button>

          <IconBtn onClick={onToggleOverlay} title={showOverlay ? 'Disable overlay' : 'Enable overlay'}>
            <span className="text-base">🧩</span>
          </IconBtn>

          <IconBtn onClick={onToggleRecording} title={isRecording ? 'Stop recording' : 'Start recording'}>
            <span className="text-base">⏺️</span>
          </IconBtn>

          <IconBtn onClick={onToggleScreenShare} title={screenOn ? 'Stop screen share' : 'Share screen'}>
            <span className="text-base">🖥️</span>
          </IconBtn>

          <IconBtn onClick={onToggleHand} title={handRaised ? 'Lower hand' : 'Raise hand'}>
            <span className="text-base">✋</span>
          </IconBtn>

          <IconBtn onClick={onToggleBlur} title={blurOn ? 'Disable blur' : 'Enable blur'}>
            <span className="text-base">🫥</span>
          </IconBtn>

          {onDock ? (
            <button
              onClick={onDock}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Dock
            </button>
          ) : null}

          <button
            onClick={onTogglePresentation}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {presentation ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      </div>

      {transcriptOpen ? (
        <div className="fixed inset-0 z-[70] bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true">
          <div className="ml-auto flex h-full w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Consultation transcript</div>
                <div className="text-xs text-slate-500">Live caption transcript. Clinician review is still required before clinical filing.</div>
              </div>
              <button
                type="button"
                onClick={() => setTranscriptOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {captionLines.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No transcript segments have arrived yet.
                </div>
              ) : (
                captionLines.map((line) => (
                  <div key={[line.speakerIdentity || line.speakerDisplay, line.sequence, line.timestamp].join(':')} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <span>{line.speakerDisplay || line.speakerName || 'Speaker'}</span>
                      <span>{new Date(line.timestamp).toLocaleTimeString()}</span>
                      {!line.final ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Partial</span> : null}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{line.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}


    </>
  );
}