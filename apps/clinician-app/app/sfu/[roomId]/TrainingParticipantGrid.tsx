'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ParticipantEvent, RoomEvent, type Participant, type RemoteParticipant, type Room } from 'livekit-client';
import { useSearchParams } from 'next/navigation';

function displayName(participant: Participant) {
  const metadata = (() => { try { return JSON.parse(participant.metadata || '{}'); } catch { return {}; } })();
  return metadata.displayName || metadata.name || participant.name || participant.identity || 'Participant';
}

function roleName(participant: Participant) {
  const metadata = (() => { try { return JSON.parse(participant.metadata || '{}'); } catch { return {}; } })();
  return String(metadata.participantRole || metadata.role || '').split('_').join(' ') || 'participant';
}

function RemoteTile({ participant, speaking, canModerate, onMute }: { participant: RemoteParticipant; speaking: boolean; canModerate: boolean; onMute: () => void }) {
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
          publication.videoTrack.attach(videoRef.current); video = true;
        }
      }
      for (const publication of participant.audioTrackPublications.values()) {
        muted = muted || publication.isMuted;
        if (publication.isSubscribed && publication.audioTrack && audioRef.current) publication.audioTrack.attach(audioRef.current);
      }
      setHasVideo(video); setMicMuted(muted);
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
      for (const publication of participant.videoTrackPublications.values()) if (videoRef.current) publication.videoTrack?.detach(videoRef.current);
      for (const publication of participant.audioTrackPublications.values()) if (audioRef.current) publication.audioTrack?.detach(audioRef.current);
    };
  }, [participant]);

  return (
    <div className={`group relative min-h-0 overflow-hidden rounded-xl bg-slate-950 ring-2 ${speaking ? 'ring-emerald-400' : 'ring-white/10'}`}>
      <video ref={videoRef} autoPlay playsInline className={`h-full w-full object-cover ${hasVideo ? '' : 'invisible'}`} />
      {!hasVideo ? <div className="absolute inset-0 grid place-items-center"><div className="grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-xl font-black text-white">{displayName(participant).split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase()}</div></div> : null}
      <audio ref={audioRef} autoPlay />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/90 to-transparent p-3 text-white"><div className="min-w-0"><div className="truncate text-xs font-black">{displayName(participant)}</div><div className="text-[10px] capitalize text-white/70">{roleName(participant)}{micMuted ? ' - muted' : ''}</div></div>{canModerate ? <button type="button" onClick={onMute} className="rounded-lg bg-white/15 px-2 py-1 text-[10px] font-black hover:bg-rose-500">Mute</button> : null}</div>
    </div>
  );
}

function LocalTile({ room }: { room: Room }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const attach = () => { for (const publication of room.localParticipant.videoTrackPublications.values()) if (publication.videoTrack && videoRef.current) publication.videoTrack.attach(videoRef.current); };
    attach(); room.on(RoomEvent.LocalTrackPublished, attach);
    return () => { room.off(RoomEvent.LocalTrackPublished, attach); for (const publication of room.localParticipant.videoTrackPublications.values()) if (videoRef.current) publication.videoTrack?.detach(videoRef.current); };
  }, [room]);
  return <div className="relative min-h-0 overflow-hidden rounded-xl bg-slate-950 ring-2 ring-indigo-400/60"><video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 text-xs font-black text-white">You</div></div>;
}

export default function TrainingParticipantGrid({ room }: { room: Room | null }) {
  const search = useSearchParams();
  const role = String(search?.get('role') || '').toLowerCase();
  const canModerate = role === 'admin' || role === 'trainer';
  const joinToken = search?.get('joinToken') || search?.get('jt') || '';
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!room) { setParticipants([]); return; }
    const refresh = () => setParticipants(Array.from(room.remoteParticipants.values()));
    const active = (items: Participant[]) => setSpeakers(items.map((item) => item.identity));
    refresh();
    room.on(RoomEvent.ParticipantConnected, refresh).on(RoomEvent.ParticipantDisconnected, refresh).on(RoomEvent.TrackSubscribed, refresh).on(RoomEvent.TrackUnsubscribed, refresh).on(RoomEvent.ActiveSpeakersChanged, active);
    return () => { room.off(RoomEvent.ParticipantConnected, refresh).off(RoomEvent.ParticipantDisconnected, refresh).off(RoomEvent.TrackSubscribed, refresh).off(RoomEvent.TrackUnsubscribed, refresh).off(RoomEvent.ActiveSpeakersChanged, active); };
  }, [room]);

  const ordered = useMemo(() => [...participants].sort((a, b) => Number(speakers.includes(b.identity)) - Number(speakers.includes(a.identity))), [participants, speakers]);
  const visible = ordered.slice(0, 11);
  const total = participants.length + (room ? 1 : 0);
  const columns = total <= 1 ? 'grid-cols-1' : total <= 4 ? 'grid-cols-2' : total <= 9 ? 'grid-cols-3' : 'grid-cols-4';

  async function mute(targetIdentity?: string) {
    if (!room || !canModerate) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/training/moderation/mute', {
        method: 'POST', headers: { 'content-type': 'application/json', ...(joinToken ? { 'x-join-token': joinToken } : {}) },
        body: JSON.stringify({ roomId: room.name, ...(targetIdentity ? { targetIdentity } : { muteAll: true }) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false) throw new Error(body?.error || 'mute_failed');
      setNotice(targetIdentity ? 'Participant microphone muted.' : `${body?.muted?.length || 0} microphone track(s) muted.`);
    } catch (error: any) { setNotice(String(error?.message || 'Mute failed').split('_').join(' ')); }
    finally { setBusy(false); }
  }

  if (!room) return <div className="grid h-full place-items-center text-sm font-semibold text-white/60">Join the room to see participants.</div>;

  return (
    <div className="absolute inset-0 flex flex-col bg-black p-2">
      <div className="mb-2 flex items-center justify-between gap-3 text-white"><div className="text-xs font-bold">{total} participant{total === 1 ? '' : 's'} connected{ordered.length > visible.length ? ` - ${ordered.length - visible.length} in overflow` : ''}</div>{canModerate ? <button type="button" disabled={busy || participants.length === 0} onClick={() => void mute()} className="pointer-events-auto rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black hover:bg-rose-600 disabled:opacity-40">Mute all</button> : null}</div>
      {notice ? <div className="mb-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">{notice}</div> : null}
      <div className={`grid min-h-0 flex-1 auto-rows-fr gap-2 ${columns}`}><LocalTile room={room} />{visible.map((participant) => <RemoteTile key={participant.identity} participant={participant} speaking={speakers.includes(participant.identity)} canModerate={canModerate} onMute={() => void mute(participant.identity)} />)}</div>
    </div>
  );
}
