// apps/patient-app/app/rtc/page.tsx
'use client';

import RemoteAudio from '@/src/components/rtc/RemoteAudio';
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'next/navigation';
import LocalMedia from '@/src/components/rtc/LocalMedia';
import RemoteVideo from '@/src/components/rtc/RemoteVideo';
import DeviceSelect from '@/src/components/rtc/DeviceSelect';
import OutputSelect from '@/src/components/rtc/OutputSelect';
import ChatPanel from '@/src/components/rtc/ChatPanel';
import StatsPanel from '@/src/components/rtc/StatsPanel';
import Captions from '@/src/components/rtc/Captions';
import { connectSignal, type SigMsg } from '@/src/lib/signal';
import { buildIceServers } from '@/src/lib/ice';

const ROLE = 'patient' as const;

function applySenderParams(pc: RTCPeerConnection) {
  try {
    pc.getSenders()
      .filter(
        (sender) =>
          sender.track?.kind === 'video' &&
          typeof sender.getParameters === 'function' &&
          typeof sender.setParameters === 'function',
      )
      .forEach((sender) => {
        try {
          const current = sender.getParameters();
          const encodings = Array.isArray(current.encodings)
            ? [...current.encodings]
            : [];

          if (encodings.length === 0) {
            encodings.push({});
          }

          encodings[0] = {
            ...encodings[0],
            maxBitrate: 1_000_000,
          };

          const next: RTCRtpSendParameters = {
            ...current,
            encodings,
          };

          void sender.setParameters(next);
        } catch {
          // Non-fatal. Browser support for modifying sender params varies.
        }
      });
  } catch {
    // Non-fatal. Keep RTC running even if sender tuning is unavailable.
  }
}

function RTCContent() {
  const search = useSearchParams();

  const queryParam = useCallback(
    (key: string) => search?.get(key)?.trim() ?? '',
    [search],
  );

  const signalUrl =
    process.env.NEXT_PUBLIC_SIGNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_RTC_SIGNAL_URL?.trim() ||
    '';

  const room = useMemo(
    () =>
      queryParam('room') ||
      queryParam('roomId') ||
      process.env.NEXT_PUBLIC_RTC_ROOM?.trim() ||
      '',
    [queryParam],
  );

  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [deviceIds, setDeviceIds] = useState<{
    audioId: string | null;
    videoId: string | null;
  }>({
    audioId: null,
    videoId: null,
  });
  const [log, setLog] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [remoteMuted, setRemoteMuted] = useState(false);

  const SELF_NAME = process.env.NEXT_PUBLIC_SELF_NAME || 'Me';
  const PEER_NAME = process.env.NEXT_PUBLIC_PEER_NAME || 'Clinician';

  const id = useMemo(() => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${performance
      .now()
      .toString(36)
      .replace('.', '')}`;
  }, []);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sigRef = useRef<ReturnType<typeof connectSignal> | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const makingOffer = useRef(false);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  function append(msg: string) {
    setLog((items) => [...items, msg].slice(-400));
  }

  useEffect(() => {
    if (!active) {
      sigRef.current?.close();
      sigRef.current = null;

      if (pcRef.current) {
        try {
          pcRef.current.getSenders().forEach((sender) => {
            try {
              sender.track?.stop();
            } catch {}
          });
        } catch {}

        try {
          pcRef.current.close();
        } catch {}
      }

      pcRef.current = null;
      pendingIce.current = [];
      setRemoteStream(null);
      setRemotePeerId(null);
      setWaiting(true);
      setSharing(false);
      setRemoteMuted(false);
      append('session: stopped');
      return;
    }

    if (!signalUrl) {
      append('error: RTC signal URL is not configured.');
      setActive(false);
      return;
    }

    if (!room) {
      append('error: RTC room is not configured.');
      setActive(false);
      return;
    }

    append('session: starting…');

    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    pcRef.current = pc;

    const inbound = new MediaStream();
    setRemoteStream(inbound);

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? inbound;

      if (ev.track && !stream.getTracks().includes(ev.track)) {
        stream.addTrack(ev.track);
      }

      setRemoteStream(stream);
      append(`webrtc: ontrack (${ev.track.kind})`);
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;

      sigRef.current?.send({
        type: 'ice',
        data: ev.candidate,
        target: remotePeerId || undefined,
      } as any);
    };

    pc.oniceconnectionstatechange = () => {
      append(`pc: ice=${pc.iceConnectionState}`);
    };

    pc.onconnectionstatechange = () => {
      append(`pc: conn=${pc.connectionState}`);
    };

    pc.onnegotiationneeded = async () => {
      try {
        /*
         * Patient side is polite/answering by default. The clinician/SFU side
         * should normally initiate offers. Keep this handler as a defensive
         * no-op to avoid accidental offer glare from patient-app.
         */
        if (pc.signalingState !== 'stable') return;
      } catch (e) {
        console.error(e);
      }
    };

    const sig = connectSignal(signalUrl, room, id, async (m: SigMsg) => {
      try {
        if (m.type === '_open') {
          append('signal: connected');
          sigRef.current?.send({ type: 'join', room, id, role: ROLE } as any);
          sigRef.current?.send({ type: 'knock' } as any);
          append('lobby: knocked');
          return;
        }

        if (m.type === '_close') {
          append('signal: closed');
          return;
        }

        if (m.type === '_error') {
          append('signal: error');
          return;
        }

        if (m.type === 'welcome') {
          const peers = Array.isArray((m as any).peers)
            ? (m as any).peers
            : [];
          const firstPeer = peers[0];

          if (firstPeer?.id) {
            setRemotePeerId(firstPeer.id);
            append(`welcome: peer ${firstPeer.id}`);
          }

          return;
        }

        if (m.type === 'admitted') {
          append('lobby: admitted');
          setWaiting(false);
          return;
        }

        if (m.type === 'rejected') {
          append('lobby: rejected');
          setWaiting(true);
          return;
        }

        if (m.type === 'join' || m.type === 'peer-joined') {
          const peerId = (m as any).id || (m as any).clientId || null;
          setRemotePeerId(peerId);
          append(`peer join: ${peerId ?? 'unknown'}`);
          return;
        }

        if (m.type === 'peer-left') {
          const peerId = (m as any).id || (m as any).clientId || null;

          if (peerId && peerId === remotePeerId) {
            setRemotePeerId(null);
            setWaiting(true);
          }

          append(`peer left: ${peerId ?? 'unknown'}`);
          return;
        }

        if (m.type === 'ctrl' && (m as any).key === 'remote-mic') {
          const wantOff = Boolean((m as any).off);
          setRemoteMuted(wantOff);

          if (localStream) {
            localStream.getAudioTracks().forEach((track) => {
              track.enabled = !wantOff && micOn;
            });
          }

          setMicOn(!wantOff);
          return;
        }

        if (m.type === 'typing') {
          (window as any).__peerTyping?.(Boolean((m as any).on));
          return;
        }

        if (m.type === 'chat') {
          (window as any).__chatAdd?.({
            id: m.id || 'peer',
            text: (m as any).text || '',
            ts: Date.now(),
            mine: false,
          });
          return;
        }

        if (m.type === 'offer') {
          append('signal: offer ←');

          const fromId = (m as any).id || (m as any).from || null;
          if (fromId) setRemotePeerId(fromId);

          const offer = m.data as RTCSessionDescriptionInit;
          const isCollision =
            makingOffer.current || pc.signalingState !== 'stable';

          if (isCollision) {
            append('negotiation: glare (patient rolls back)');
            await pc.setLocalDescription({
              type: 'rollback',
            } as RTCSessionDescriptionInit);
          }

          await pc.setRemoteDescription(offer);

          const answer = await pc.createAnswer();
          append('webrtc: created answer');

          await pc.setLocalDescription(answer);

          sigRef.current?.send({
            type: 'answer',
            data: pc.localDescription,
            target: fromId || remotePeerId || undefined,
          } as any);

          append('signal: answer →');

          if (pc.remoteDescription) {
            for (const candidate of pendingIce.current.splice(0)) {
              try {
                await pc.addIceCandidate(candidate);
              } catch (e) {
                console.error(e);
              }
            }
          }

          return;
        }

        if (m.type === 'answer') {
          append('signal: answer ←');

          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(m.data as RTCSessionDescriptionInit);
          } else {
            append(`warn: answer ignored (state=${pc.signalingState})`);
          }

          return;
        }

        if (m.type === 'ice' && m.data) {
          const candidate = m.data as RTCIceCandidateInit;

          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate);
          } else {
            pendingIce.current.push(candidate);
          }
        }
      } catch (e) {
        console.error(e);
        append(`error: ${(e as Error).message}`);
      }
    });

    sigRef.current = sig;

    return () => {
      sig.close();

      if (pcRef.current === pc) {
        try {
          pc.getSenders().forEach((sender) => {
            try {
              sender.track?.stop();
            } catch {}
          });
        } catch {}

        try {
          pc.close();
        } catch {}

        pcRef.current = null;
      }
    };
  }, [active, room, id, remotePeerId, localStream, micOn, signalUrl]);

  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !active) return;

    pc.getSenders()
      .filter(
        (sender) =>
          sender.track &&
          (sender.track.kind === 'audio' || sender.track.kind === 'video'),
      )
      .forEach((sender) => {
        try {
          pc.removeTrack(sender);
        } catch {}
      });

    if (!localStream) {
      append('webrtc: no local tracks');
      return;
    }

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = micOn && !remoteMuted;
    });

    localStream.getVideoTracks().forEach((track) => {
      track.enabled = camOn;
    });

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    append(
      `webrtc: local tracks ready (${localStream
        .getTracks()
        .map((track) => track.kind)
        .join(',')})`,
    );

    applySenderParams(pc);
    append('webrtc: sender params applied');
  }, [
    localStream,
    active,
    micOn,
    camOn,
    remoteMuted,
    deviceIds.audioId,
    deviceIds.videoId,
  ]);

  async function toggleShare() {
    const pc = pcRef.current;
    if (!pc) return;

    if (!sharing) {
      try {
        if (
          typeof navigator === 'undefined' ||
          !navigator.mediaDevices?.getDisplayMedia
        ) {
          append('share: display capture is not available in this browser.');
          return;
        }

        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        setSharing(true);

        const displayVideo = displayStream.getVideoTracks()[0];
        const displayAudio = displayStream.getAudioTracks()[0];

        const videoSender = pc
          .getSenders()
          .find((sender) => sender.track?.kind === 'video');

        if (videoSender && displayVideo) {
          await videoSender.replaceTrack(displayVideo);
        }

        const audioSender = pc
          .getSenders()
          .find((sender) => sender.track?.kind === 'audio');

        if (audioSender && displayAudio) {
          await audioSender.replaceTrack(displayAudio);
        }

        displayVideo?.addEventListener('ended', async () => {
          setSharing(false);

          if (!localStream) return;

          const localVideo = localStream.getVideoTracks()[0];
          const localAudio = localStream.getAudioTracks()[0];

          const restoreVideo = pc
            .getSenders()
            .find((sender) => sender.track?.kind === 'video');

          if (restoreVideo && localVideo) {
            await restoreVideo.replaceTrack(localVideo);
          }

          const restoreAudio = pc
            .getSenders()
            .find((sender) => sender.track?.kind === 'audio');

          if (restoreAudio && localAudio) {
            await restoreAudio.replaceTrack(localAudio);
          }

          append('share: screen off');
        });

        append('share: screen on');
      } catch {
        append('share: cancelled or failed');
      }

      return;
    }

    setSharing(false);

    if (!localStream) return;

    const localVideo = localStream.getVideoTracks()[0];
    const localAudio = localStream.getAudioTracks()[0];

    const videoSender = pc
      .getSenders()
      .find((sender) => sender.track?.kind === 'video');

    if (videoSender && localVideo) {
      await videoSender.replaceTrack(localVideo);
    }

    const audioSender = pc
      .getSenders()
      .find((sender) => sender.track?.kind === 'audio');

    if (audioSender && localAudio) {
      await audioSender.replaceTrack(localAudio);
    }

    append('share: screen off');
  }

  function sendChat(text: string) {
    sigRef.current?.send({ type: 'chat', text } as any);
  }

  function setTyping(on: boolean) {
    sigRef.current?.send({
      type: 'typing',
      on,
      target: remotePeerId || undefined,
    } as any);
  }

  return (
    <main data-p-ui="patient-rtc-page" className="min-h-[calc(100svh-4rem)] space-y-4 overflow-x-clip px-3 py-4 sm:px-5 sm:py-6">
      <div data-p-ui="patient-rtc-hero" className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Secure consultation room</p><h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Patient video consultation</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Join your clinician, manage devices, exchange messages and follow captions from one mobile-ready workspace.</p></div>

      <div data-p-ui="patient-rtc-layout" className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <div data-p-ui="patient-rtc-media-pane" className="min-w-0 space-y-3">
          <div data-p-ui="patient-rtc-controls-card" className="space-y-3 rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="text-sm opacity-70">Controls</div>

            {!signalUrl || !room ? (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                RTC requires NEXT_PUBLIC_SIGNAL_URL or
                NEXT_PUBLIC_RTC_SIGNAL_URL and a room value.
              </div>
            ) : null}

            {waiting && active ? (
              <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                Waiting for the clinician to admit this session.
              </div>
            ) : null}

            <div data-p-ui="patient-rtc-controls" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {!active ? (
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  disabled={!signalUrl || !room}
                  onClick={() => setActive(true)}
                >
                  Start Session
                </button>
              ) : (
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
                  onClick={() => setActive(false)}
                >
                  End Session
                </button>
              )}

              <button
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
                onClick={() => setMicOn((value) => !value)}
              >
                {micOn ? 'Mute Mic' : 'Unmute Mic'}
              </button>

              <button
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
                onClick={() => setCamOn((value) => !value)}
              >
                {camOn ? 'Camera Off' : 'Camera On'}
              </button>

              <button className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50" onClick={toggleShare}>
                {sharing ? 'Stop Share' : 'Share Screen'}
              </button>
            </div>

            <div className="text-xs opacity-70">
              Room: {room || 'Not configured'} • Role: {ROLE}
            </div>
          </div>

          <details className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
            <summary className="cursor-pointer select-none">Devices</summary>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <DeviceSelect
                audioId={deviceIds.audioId}
                videoId={deviceIds.videoId}
                onChange={setDeviceIds}
              />
              <OutputSelect videoRef={remoteVideoRef} />
            </div>
          </details>

          <div className="space-y-2">
            <div className="text-sm font-medium">Local Preview</div>
            <LocalMedia
              active={active}
              micOn={micOn && !remoteMuted}
              camOn={camOn}
              deviceIds={deviceIds}
              onStream={setLocalStream}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Remote Preview</div>
            <div className="space-y-3">
              <RemoteVideo
                ref={remoteVideoRef}
                stream={remoteStream}
                overlayText={PEER_NAME}
              />
              <RemoteAudio stream={remoteStream} />
            </div>
          </div>
        </div>

        <div data-p-ui="patient-rtc-chat-pane" className="min-w-0 space-y-3">
          <div data-p-ui="patient-rtc-chat-card" className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white/90 shadow-sm"><ChatPanel
            send={sendChat}
            onTyping={setTyping}
            selfLabel={SELF_NAME || 'Me'}
            peerLabel={PEER_NAME}
          />

          <details className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
            <summary className="cursor-pointer select-none">Network Stats</summary>
            <div className="mt-2">
              <StatsPanel pc={pcRef.current} />
            </div>
          </details>

          <Captions lang="en-GB" />

          <details className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
            <summary className="cursor-pointer select-none">Status</summary>
            <div className="mt-2">
              <pre className="max-h-[42svh] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-3 text-xs leading-tight text-slate-50">
                {log.map((item, index) => (
                  <span key={`${index}-${item}`}>
                    {item}
                    {'\n'}
                  </span>
                ))}
              </pre>
            </div>
          </details>
        </div>
      </div>
    </main>
  );
}

export default function RTC() {
  return (
    <Suspense
      fallback={
        <main data-p-ui="patient-rtc-page" className="min-h-[50svh] px-3 py-4 text-sm text-slate-600 sm:px-6">
          Loading RTC session…
        </main>
      }
    >
      <RTCContent />
    </Suspense>
  );
}