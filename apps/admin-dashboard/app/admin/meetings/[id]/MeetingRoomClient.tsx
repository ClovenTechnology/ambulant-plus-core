'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from '@livekit/components-react';
import { MessageSquare, Send, Video } from 'lucide-react';

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', { timeStyle: 'short' }).format(date);
}

export function MeetingRoomClient({
  meeting,
  onMeetingChanged,
}: {
  meeting: any;
  onMeetingChanged: () => Promise<void> | void;
}) {
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [roomError, setRoomError] = useState('');
  const [joining, setJoining] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatBody, setChatBody] = useState('');
  const [actorProfileId, setActorProfileId] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const closed = ['ENDED', 'CANCELLED', 'EXPIRED'].includes(meeting?.state);

  async function loadChat() {
    if (!meeting?.allowChat) return;
    const response = await fetch(`/api/admin/meetings/${encodeURIComponent(meeting.id)}/chat`, {
      cache: 'no-store',
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) return;
    setMessages(json.messages || []);
    setActorProfileId(json.actorProfileId || '');
  }

  useEffect(() => {
    void loadChat();
    if (!meeting?.allowChat || closed) return;
    const timer = window.setInterval(() => void loadChat(), 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id, meeting?.allowChat, closed]);

  async function join() {
    setJoining(true);
    setRoomError('');
    try {
      const response = await fetch(`/api/admin/meetings/${encodeURIComponent(meeting.id)}/rtc-token`, {
        method: 'POST',
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to obtain room credential');
      setToken(json.token);
      setServerUrl(json.wsUrl);
      await onMeetingChanged();
    } catch (err: any) {
      setRoomError(err?.message || 'Unable to join meeting room');
    } finally {
      setJoining(false);
    }
  }

  async function sendChat(event: React.FormEvent) {
    event.preventDefault();
    if (!chatBody.trim()) return;
    setChatBusy(true);
    try {
      const response = await fetch(`/api/admin/meetings/${encodeURIComponent(meeting.id)}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: chatBody.trim() }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to send meeting message');
      setChatBody('');
      await loadChat();
    } catch (err: any) {
      setRoomError(err?.message || 'Unable to send meeting message');
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-hidden rounded-3xl border bg-slate-950 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 text-white">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Enterprise meeting room</div>
            <div className="mt-1 text-sm text-white/70">LiveKit media credentials are minted server-side for your canonical Staff participant.</div>
          </div>
          {!token && !closed ? <button type="button" onClick={join} disabled={joining} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"><Video className="h-4 w-4" />{joining ? 'Joining…' : 'Join room'}</button> : null}
        </div>

        {roomError ? <div className="border-b border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{roomError}</div> : null}

        {token && serverUrl ? (
          <div className="min-h-[520px] bg-slate-950" data-lk-theme="default">
            <LiveKitRoom
              token={token}
              serverUrl={serverUrl}
              connect={true}
              audio={meeting.allowAudio !== false}
              video={meeting.allowVideo !== false}
              onDisconnected={() => {
                setToken('');
                setServerUrl('');
                void onMeetingChanged();
              }}
              style={{ height: '520px' }}
            >
              <VideoConference />
              <RoomAudioRenderer />
            </LiveKitRoom>
          </div>
        ) : (
          <div className="grid min-h-[420px] place-items-center p-8 text-center text-sm text-white/60">
            {closed ? 'This meeting has ended. The room is closed.' : 'Join when you are ready. Audio/video permissions follow the canonical Meeting policy.'}
          </div>
        )}
      </div>

      <div className="flex min-h-[520px] flex-col rounded-3xl border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b p-4"><MessageSquare className="h-4 w-4" /><h3 className="font-semibold">Persistent room chat</h3></div>
        {!meeting.allowChat ? <div className="p-4 text-sm text-slate-500">Chat is disabled for this meeting.</div> : null}
        {meeting.allowChat ? <>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? <div className="text-sm text-slate-400">No persistent staff messages yet.</div> : null}
            {messages.map((item) => {
              const mine = item.senderProfileId === actorProfileId;
              return <div key={item.id} className={`rounded-2xl p-3 text-sm ${mine ? 'ml-8 bg-cyan-50' : 'mr-8 bg-slate-50'}`}><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{mine ? 'You' : item.senderProfile?.name || item.senderProfile?.email}</div><div className="mt-1 whitespace-pre-wrap leading-6 text-slate-800">{item.body}</div><div className="mt-1 text-[10px] text-slate-400">{formatTime(item.createdAt)}</div></div>;
            })}
          </div>
          <form onSubmit={sendChat} className="flex gap-2 border-t p-3"><textarea value={chatBody} onChange={(event) => setChatBody(event.target.value)} disabled={closed} className="min-h-11 flex-1 resize-none rounded-xl border px-3 py-2 text-sm" placeholder={closed ? 'Meeting chat is closed' : 'Message the room'} /><button type="submit" disabled={chatBusy || closed || !chatBody.trim()} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><Send className="h-4 w-4" />Send</button></form>
        </> : null}
      </div>
    </section>
  );
}
