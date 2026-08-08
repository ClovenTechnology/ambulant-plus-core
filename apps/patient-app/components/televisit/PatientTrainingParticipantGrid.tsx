'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ParticipantEvent,
  RoomEvent,
  type Participant,
  type RemoteParticipant,
  type Room,
} from 'livekit-client';

function metadata(participant: Participant): Record<string, any> {
  try {
    const value = JSON.parse(participant.metadata || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function displayName(participant: Participant) {
  const value = metadata(participant);
  return value.displayName || value.name || participant.name || participant.identity || 'Participant';
}

function roleName(participant: Participant) {
  const value = metadata(participant);
  return String(value.participantRole || value.role || 'participant').split('_').join(' ');
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'P';
}

function RemoteTile({ participant, speaking }: { participant: RemoteParticipant; speaking: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [micMuted, setMicMuted] = useState(false);

  useEffect(() => {
    const attach = () => {
      let video = false;
      let muted = false;

      for (const publication of participant.videoTrackPublications.values()) {
        if (publication.isSubscribed && publication.videoTrack && videoRef.current) {
          publication.videoTrack.attach(videoRef.current);
          video = true;
        }
      }

      for (const publication of participant.audioTrackPublications.values()) {
        muted = muted || publication.isMuted;
        if (publication.isSubscribed && publication.audioTrack && audioRef.current) {
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
    <div className={`group relative min-h-0 overflow-hidden rounded-xl bg-slate-950 ring-2 ${speaking ? 'ring-emerald-400' : 'ring-white/10'}`}>
      <video ref={videoRef} autoPlay playsInline className={`h-full w-full object-cover ${hasVideo ? '' : 'invisible'}`} />
      {!hasVideo ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-xl font-black text-white">
            {initials(displayName(participant))}
          </div>
        </div>
      ) : null}
      <audio ref={audioRef} autoPlay />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 text-white">
        <div className="truncate text-xs font-black">{displayName(participant)}</div>
        <div className="text-[10px] capitalize text-white/70">
          {roleName(participant)}{micMuted ? ' - muted' : ''}
        </div>
      </div>
    </div>
  );
}

function LocalTile({ room }: { room: Room }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const attach = () => {
      for (const publication of room.localParticipant.videoTrackPublications.values()) {
        if (publication.videoTrack && videoRef.current) publication.videoTrack.attach(videoRef.current);
      }
    };

    attach();
    room.on(RoomEvent.LocalTrackPublished, attach);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, attach);
      for (const publication of room.localParticipant.videoTrackPublications.values()) {
        if (videoRef.current) publication.videoTrack?.detach(videoRef.current);
      }
    };
  }, [room]);

  return (
    <div className="relative min-h-0 overflow-hidden rounded-xl bg-slate-950 ring-2 ring-indigo-400/60">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 text-xs font-black text-white">You</div>
    </div>
  );
}

export default function PatientTrainingParticipantGrid({ room }: { room: Room | null }) {
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [speakers, setSpeakers] = useState<string[]>([]);

  useEffect(() => {
    if (!room) {
      setParticipants([]);
      setSpeakers([]);
      return;
    }

    const refresh = () => setParticipants(Array.from(room.remoteParticipants.values()));
    const active = (items: Participant[]) => setSpeakers(items.map((item) => item.identity));

    refresh();
    room
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.TrackSubscribed, refresh)
      .on(RoomEvent.TrackUnsubscribed, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, active);

    return () => {
      room
        .off(RoomEvent.ParticipantConnected, refresh)
        .off(RoomEvent.ParticipantDisconnected, refresh)
        .off(RoomEvent.TrackSubscribed, refresh)
        .off(RoomEvent.TrackUnsubscribed, refresh)
        .off(RoomEvent.ActiveSpeakersChanged, active);
    };
  }, [room]);

  const ordered = useMemo(
    () => [...participants].sort((a, b) => Number(speakers.includes(b.identity)) - Number(speakers.includes(a.identity))),
    [participants, speakers],
  );
  const visible = ordered.slice(0, 11);
  const total = participants.length + (room ? 1 : 0);
  const columns = total <= 1 ? 'grid-cols-1' : total <= 4 ? 'grid-cols-2' : total <= 9 ? 'grid-cols-3' : 'grid-cols-4';

  if (!room) {
    return <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-white/60">Join the room to see participants.</div>;
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-black p-2">
      <div className="mb-2 text-xs font-bold text-white">
        {total} participant{total === 1 ? '' : 's'} connected
        {ordered.length > visible.length ? ` - ${ordered.length - visible.length} in overflow` : ''}
      </div>
      <div className={`grid min-h-0 flex-1 auto-rows-fr gap-2 ${columns}`}>
        <LocalTile room={room} />
        {visible.map((participant) => (
          <RemoteTile
            key={participant.identity}
            participant={participant}
            speaking={speakers.includes(participant.identity)}
          />
        ))}
      </div>
    </div>
  );
}
