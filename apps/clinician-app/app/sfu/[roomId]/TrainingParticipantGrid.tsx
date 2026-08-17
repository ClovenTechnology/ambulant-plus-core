'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ParticipantEvent,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type Room,
} from 'livekit-client';
import { useSearchParams } from 'next/navigation';

type ObserverCapabilities = {
  microphone: boolean;
  camera: boolean;
  chat: boolean;
};

type ScreenShareRef = {
  id: string;
  label: string;
  publication: any;
};

function participantMetadata(participant: Participant) {
  try {
    return JSON.parse(participant.metadata || '{}') as Record<string, any>;
  } catch {
    return {};
  }
}

function displayName(participant: Participant) {
  const metadata = participantMetadata(participant);
  return metadata.displayName || metadata.name || participant.name || participant.identity || 'Participant';
}

function roleName(participant: Participant) {
  const metadata = participantMetadata(participant);
  return String(metadata.participantRole || metadata.role || '').split('_').join(' ') || 'participant';
}

function participantRole(participant: Participant) {
  const metadata = participantMetadata(participant);
  return String(metadata.participantRole || metadata.role || '').trim().toLowerCase();
}

function observerCapabilitiesFromParticipant(participant: Participant): ObserverCapabilities {
  const attributes = ((participant as any).attributes || {}) as Record<string, string>;
  return {
    microphone: attributes.trainingMediaMicrophone === '1',
    camera: attributes.trainingMediaCamera === '1',
    chat: attributes.trainingChatWrite === '1',
  };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'P';
}

function RemoteTile({
  participant,
  speaking,
  canModerate,
  handRaised,
  capabilities,
  busy,
  onMute,
  onLowerHand,
  onCapability,
}: {
  participant: RemoteParticipant;
  speaking: boolean;
  canModerate: boolean;
  handRaised: boolean;
  capabilities: ObserverCapabilities;
  busy: boolean;
  onMute: () => void;
  onLowerHand: () => void;
  onCapability: (capability: keyof ObserverCapabilities, enabled: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const role = participantRole(participant);
  const isObserver = role === 'observer';

  useEffect(() => {
    const attach = () => {
      let video = false;
      let muted = false;

      for (const publication of participant.videoTrackPublications.values()) {
        if (
          publication.source === Track.Source.Camera &&
          publication.isSubscribed &&
          publication.videoTrack &&
          videoRef.current
        ) {
          publication.videoTrack.attach(videoRef.current);
          video = true;
        }
      }

      for (const publication of participant.audioTrackPublications.values()) {
        if (publication.source === Track.Source.Microphone) {
          muted = muted || publication.isMuted;
        }
        if (
          publication.isSubscribed &&
          publication.audioTrack &&
          audioRef.current
        ) {
          publication.audioTrack.attach(audioRef.current);
        }
      }

      setHasVideo(video);
      setMicMuted(muted);
    };

    attach();
    participant
      .on(ParticipantEvent.TrackSubscribed, attach)
      .on(ParticipantEvent.TrackUnsubscribed, attach)
      .on(ParticipantEvent.TrackMuted, attach)
      .on(ParticipantEvent.TrackUnmuted, attach);

    return () => {
      participant
        .off(ParticipantEvent.TrackSubscribed, attach)
        .off(ParticipantEvent.TrackUnsubscribed, attach)
        .off(ParticipantEvent.TrackMuted, attach)
        .off(ParticipantEvent.TrackUnmuted, attach);

      for (const publication of participant.videoTrackPublications.values()) {
        if (videoRef.current) publication.videoTrack?.detach(videoRef.current);
      }
      for (const publication of participant.audioTrackPublications.values()) {
        if (audioRef.current) publication.audioTrack?.detach(audioRef.current);
      }
    };
  }, [participant]);

  return (
    <div
      className={`group relative min-h-0 overflow-hidden rounded-2xl border bg-slate-950 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.85)] transition ${
        speaking
          ? 'border-emerald-400/80 ring-2 ring-emerald-400/35'
          : handRaised
            ? 'border-amber-400/80 ring-2 ring-amber-400/30'
            : 'border-white/10'
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`h-full w-full object-cover ${hasVideo ? '' : 'invisible'}`}
      />

      {!hasVideo ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-slate-800/90 text-xl font-semibold tracking-[-0.03em] text-white shadow-lg">
            {initials(displayName(participant))}
          </div>
        </div>
      ) : null}

      <audio ref={audioRef} autoPlay />

      {handRaised ? (
        <div className="absolute left-3 top-3 rounded-full border border-amber-300/60 bg-amber-300/95 px-2.5 py-1 text-[10px] font-semibold text-slate-950 shadow-lg backdrop-blur">
          ✋ Hand raised
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-3.5 text-white">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold tracking-[-0.01em]">{displayName(participant)}</div>
            <div className="text-[10px] capitalize text-white/70">
              {roleName(participant)}{micMuted ? ' · muted' : ''}
            </div>
          </div>

          {canModerate ? (
            <button
              type="button"
              disabled={busy}
              onClick={onMute}
              className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold backdrop-blur transition hover:border-rose-400/60 hover:bg-rose-500/90 disabled:opacity-40"
            >
              Mute
            </button>
          ) : null}
        </div>

        {canModerate && (handRaised || isObserver) ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {handRaised ? (
              <button
                type="button"
                disabled={busy}
                onClick={onLowerHand}
                className="rounded-full border border-amber-200/70 bg-amber-300 px-2.5 py-1 text-[10px] font-semibold text-slate-950 shadow-sm transition hover:bg-amber-200 disabled:opacity-40"
              >
                Lower hand
              </button>
            ) : null}

            {isObserver ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onCapability('microphone', !capabilities.microphone)}
                  className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold backdrop-blur transition hover:bg-white/20 disabled:opacity-40"
                >
                  {capabilities.microphone ? 'Revoke mic' : 'Allow mic'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onCapability('camera', !capabilities.camera)}
                  className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold backdrop-blur transition hover:bg-white/20 disabled:opacity-40"
                >
                  {capabilities.camera ? 'Revoke camera' : 'Allow camera'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onCapability('chat', !capabilities.chat)}
                  className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold backdrop-blur transition hover:bg-white/20 disabled:opacity-40"
                >
                  {capabilities.chat ? 'Disable chat' : 'Enable chat'}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LocalTile({ room }: { room: Room }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const attach = () => {
      let video = false;
      for (const publication of room.localParticipant.videoTrackPublications.values()) {
        if (
          publication.source === Track.Source.Camera &&
          publication.videoTrack &&
          videoRef.current
        ) {
          publication.videoTrack.attach(videoRef.current);
          video = true;
        }
      }
      setHasVideo(video);
    };

    attach();
    room.on(RoomEvent.LocalTrackPublished, attach);
    room.on(RoomEvent.LocalTrackUnpublished, attach);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, attach);
      room.off(RoomEvent.LocalTrackUnpublished, attach);
      for (const publication of room.localParticipant.videoTrackPublications.values()) {
        if (videoRef.current) publication.videoTrack?.detach(videoRef.current);
      }
    };
  }, [room]);

  return (
    <div className="relative min-h-0 overflow-hidden rounded-2xl border border-indigo-300/40 bg-slate-950 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.85)] ring-2 ring-indigo-400/25">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${hasVideo ? '' : 'invisible'}`}
      />
      {!hasVideo ? (
        <div className="absolute inset-0 grid place-items-center text-sm font-medium text-white/55">
          Camera off
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3.5 text-xs font-semibold text-white">
        You
      </div>
    </div>
  );
}

function ScreenShareStage({ share }: { share: ScreenShareRef }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isLocalShare = share.id === 'local-screen-share';

  useEffect(() => {
    if (isLocalShare) return;
    const track = share.publication?.videoTrack || share.publication?.track;
    if (track && videoRef.current) track.attach(videoRef.current);
    return () => {
      if (track && videoRef.current) track.detach(videoRef.current);
    };
  }, [isLocalShare, share]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-inner">
      {isLocalShare ? (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,_rgba(79,70,229,0.22),_transparent_45%),linear-gradient(135deg,_#0f172a,_#020617)] p-6 text-center">
          <div className="max-w-md">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/10 text-lg text-white shadow-lg backdrop-blur">
              ↗
            </div>
            <div className="mt-4 text-base font-semibold tracking-[-0.02em] text-white">
              Your screen is being shared
            </div>
            <div className="mt-2 text-sm leading-6 text-white/60">
              The local mirror preview is hidden to prevent the infinity effect. Other participants continue to receive the live shared screen.
            </div>
          </div>
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain" />
      )}
      <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white shadow-lg backdrop-blur">
        {share.label} · sharing screen
      </div>
    </div>
  );
}

export default function TrainingParticipantGrid({ room }: { room: Room | null }) {
  const search = useSearchParams();
  const role = String(search?.get('role') || '').toLowerCase();
  const canModerate = role === 'admin' || role === 'trainer';
  const joinToken = search?.get('joinToken') || search?.get('jt') || '';

  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [handStates, setHandStates] = useState<Record<string, boolean>>({});
  const [observerCaps, setObserverCaps] = useState<Record<string, ObserverCapabilities>>({});
  const [screenShare, setScreenShare] = useState<ScreenShareRef | null>(null);
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');

  function refreshObserverCapabilities(items: RemoteParticipant[]) {
    setObserverCaps((current) => {
      const next = { ...current };
      for (const participant of items) {
        if (participantRole(participant) === 'observer') {
          next[participant.identity] = observerCapabilitiesFromParticipant(participant);
        }
      }
      return next;
    });
  }

  function refreshScreenShare(r: Room, items: RemoteParticipant[]) {
    for (const publication of r.localParticipant.videoTrackPublications.values()) {
      if (publication.source === Track.Source.ScreenShare && publication.videoTrack) {
        setScreenShare({
          id: 'local-screen-share',
          label: 'You',
          publication,
        });
        return;
      }
    }

    for (const participant of items) {
      for (const publication of participant.videoTrackPublications.values()) {
        if (
          publication.source === Track.Source.ScreenShare &&
          publication.isSubscribed &&
          publication.videoTrack
        ) {
          setScreenShare({
            id: `${participant.identity}:screen-share`,
            label: displayName(participant),
            publication,
          });
          return;
        }
      }
    }

    setScreenShare(null);
  }

  useEffect(() => {
    if (!room) {
      setParticipants([]);
      setScreenShare(null);
      return;
    }

    const refresh = () => {
      const items = Array.from(room.remoteParticipants.values());
      setParticipants(items);
      refreshObserverCapabilities(items);
      refreshScreenShare(room, items);
    };

    const active = (items: Participant[]) => {
      setSpeakers(items.map((item) => item.identity));
    };

    const attributesChanged = (_changed: Record<string, string>, participant: Participant) => {
      if (participant.identity && participantRole(participant) === 'observer') {
        setObserverCaps((current) => ({
          ...current,
          [participant.identity]: observerCapabilitiesFromParticipant(participant),
        }));
      }
      refreshScreenShare(room, Array.from(room.remoteParticipants.values()));
    };

    refresh();
    room
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.TrackSubscribed, refresh)
      .on(RoomEvent.TrackUnsubscribed, refresh)
      .on(RoomEvent.TrackPublished, refresh)
      .on(RoomEvent.TrackUnpublished, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.ParticipantAttributesChanged, attributesChanged)
      .on(RoomEvent.ActiveSpeakersChanged, active);

    return () => {
      room
        .off(RoomEvent.ParticipantConnected, refresh)
        .off(RoomEvent.ParticipantDisconnected, refresh)
        .off(RoomEvent.TrackSubscribed, refresh)
        .off(RoomEvent.TrackUnsubscribed, refresh)
        .off(RoomEvent.TrackPublished, refresh)
        .off(RoomEvent.TrackUnpublished, refresh)
        .off(RoomEvent.LocalTrackPublished, refresh)
        .off(RoomEvent.LocalTrackUnpublished, refresh)
        .off(RoomEvent.ParticipantAttributesChanged, attributesChanged)
        .off(RoomEvent.ActiveSpeakersChanged, active);
    };
  }, [room]);

  useEffect(() => {
    if (!room) return;

    const onData = (
      payload: Uint8Array,
      participant: RemoteParticipant | undefined,
      _kind: any,
      topic?: string,
    ) => {
      if (topic !== 'control') return;

      let parsed: any = null;
      try {
        parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }

      const type = String(parsed?.type || '');
      if (type === 'raise_hand' || type === 'hand') {
        const identity = String(
          participant?.identity ||
          parsed?.targetIdentity ||
          parsed?.participantIdentity ||
          '',
        );
        if (!identity) return;
        setHandStates((current) => ({
          ...current,
          [identity]: Boolean(parsed?.value),
        }));
        return;
      }

      if (type === 'training_capability') {
        const targetIdentity = String(parsed?.targetIdentity || '');
        const capabilities = parsed?.capabilities;
        if (targetIdentity && capabilities && typeof capabilities === 'object') {
          setObserverCaps((current) => ({
            ...current,
            [targetIdentity]: {
              microphone: Boolean(capabilities.microphone),
              camera: Boolean(capabilities.camera),
              chat: Boolean(capabilities.chat),
            },
          }));
        }
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  const ordered = useMemo(
    () =>
      [...participants].sort((a, b) => {
        const handDelta = Number(Boolean(handStates[b.identity])) - Number(Boolean(handStates[a.identity]));
        if (handDelta) return handDelta;
        return Number(speakers.includes(b.identity)) - Number(speakers.includes(a.identity));
      }),
    [participants, speakers, handStates],
  );

  const visible = ordered.slice(0, 11);
  const total = participants.length + (room ? 1 : 0);
  const columns = total <= 1 ? 'grid-cols-1' : total <= 4 ? 'grid-cols-2' : total <= 9 ? 'grid-cols-3' : 'grid-cols-4';

  async function postCollaboration(payload: Record<string, unknown>) {
    if (!room || !canModerate || !joinToken) {
      throw new Error('training_moderator_admission_required');
    }

    const response = await fetch('/api/training/collaboration', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-join-token': joinToken,
      },
      body: JSON.stringify({ roomId: room.name, ...payload }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) {
      throw new Error(body?.error || 'training_collaboration_failed');
    }
    return body;
  }

  async function mute(targetIdentity?: string) {
    if (!room || !canModerate) return;
    const key = targetIdentity ? `mute:${targetIdentity}` : 'mute:all';
    setBusyKey(key);
    setNotice('');
    try {
      const response = await fetch('/api/training/moderation/mute', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(joinToken ? { 'x-join-token': joinToken } : {}),
        },
        body: JSON.stringify({
          roomId: room.name,
          ...(targetIdentity ? { targetIdentity } : { muteAll: true }),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false) {
        throw new Error(body?.error || 'mute_failed');
      }
      setNotice(
        targetIdentity
          ? 'Participant microphone muted.'
          : `${body?.muted?.length || 0} microphone track(s) muted.`,
      );
    } catch (error: any) {
      setNotice(String(error?.message || 'Mute failed').split('_').join(' '));
    } finally {
      setBusyKey('');
    }
  }

  async function lowerHand(targetIdentity: string) {
    const key = `hand:${targetIdentity}`;
    setBusyKey(key);
    setNotice('');
    try {
      await postCollaboration({ action: 'hand.lower', targetIdentity });
      setHandStates((current) => ({ ...current, [targetIdentity]: false }));
      setNotice('Participant hand lowered.');
    } catch (error: any) {
      setNotice(String(error?.message || 'Unable to lower hand.').split('_').join(' '));
    } finally {
      setBusyKey('');
    }
  }

  async function setCapability(
    targetIdentity: string,
    capability: keyof ObserverCapabilities,
    enabled: boolean,
  ) {
    const key = `capability:${targetIdentity}:${capability}`;
    setBusyKey(key);
    setNotice('');
    try {
      const body = await postCollaboration({
        action: 'capability.set',
        targetIdentity,
        capability,
        enabled,
      });

      const caps = body?.capabilities;
      if (caps) {
        setObserverCaps((current) => ({
          ...current,
          [targetIdentity]: {
            microphone: Boolean(caps.microphone),
            camera: Boolean(caps.camera),
            chat: Boolean(caps.chat),
          },
        }));
      }

      setNotice(
        enabled
          ? `Observer ${capability} capability enabled.`
          : `Observer ${capability} capability disabled.`,
      );
    } catch (error: any) {
      setNotice(String(error?.message || 'Unable to update observer capability.').split('_').join(' '));
    } finally {
      setBusyKey('');
    }
  }

  if (!room) {
    return (
      <div className="grid h-full place-items-center text-sm font-semibold text-white/60">
        Join the room to see participants.
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-950 p-2.5">
      <div className="mb-2.5 flex items-center justify-between gap-3 px-1 text-white">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/75">
          {total} participant{total === 1 ? '' : 's'} connected
          {ordered.length > visible.length ? ` · ${ordered.length - visible.length} in overflow` : ''}
        </div>
        {canModerate ? (
          <button
            type="button"
            disabled={Boolean(busyKey) || participants.length === 0}
            onClick={() => void mute()}
            className="pointer-events-auto rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition hover:border-rose-400/50 hover:bg-rose-500/90 disabled:opacity-40"
          >
            Mute all
          </button>
        ) : null}
      </div>

      {notice ? (
        <div className="mb-2.5 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur">
          {notice}
        </div>
      ) : null}

      {screenShare ? (
        <div className="mb-2.5 flex min-h-0 flex-[1.45]">
          <ScreenShareStage share={screenShare} />
        </div>
      ) : null}

      <div className={`grid min-h-0 ${screenShare ? 'h-[34%] min-h-[120px]' : 'flex-1'} auto-rows-fr gap-2.5 ${columns}`}>
        <LocalTile room={room} />
        {visible.map((participant) => (
          <RemoteTile
            key={participant.identity}
            participant={participant}
            speaking={speakers.includes(participant.identity)}
            canModerate={canModerate}
            handRaised={Boolean(handStates[participant.identity])}
            capabilities={observerCaps[participant.identity] || {
              microphone: false,
              camera: false,
              chat: false,
            }}
            busy={Boolean(busyKey)}
            onMute={() => void mute(participant.identity)}
            onLowerHand={() => void lowerHand(participant.identity)}
            onCapability={(capability, enabled) =>
              void setCapability(participant.identity, capability, enabled)
            }
          />
        ))}
      </div>
    </div>
  );
}
