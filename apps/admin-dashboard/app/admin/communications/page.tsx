'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Users,
  Video,
} from 'lucide-react';
import { useStaffCommunications } from '@/components/StaffCommunicationsProvider';
import { errorText, userFacingApiError } from '@/lib/admin-error';

export const dynamic = 'force-dynamic';

type Conversation = {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  title: string | null;
  lastMessageAt: string | null;
  members: Array<{
    profileId: string;
    role: string;
    profile: {
      id: string;
      name: string | null;
      email: string;
      photoUrl?: string | null;
      lifecycleState?: string;
      department?: { id: string; name: string } | null;
      designation?: { id: string; name: string } | null;
      presence?: { state?: string } | null;
    };
  }>;
  latestMessage?: any;
  unread?: boolean;
  unreadCount?: number;
};

function displayConversation(item: Conversation, actorProfileId: string | null) {
  if (item.kind === 'GROUP') return item.title || 'Group';
  const other = item.members.find((member) => member.profileId !== actorProfileId)?.profile;
  return other?.name || other?.email || 'Direct conversation';
}

function StaffAvatar({ profile, size = 'h-9 w-9' }: { profile: any; size?: string }) {
  const label = profile?.name || profile?.email || 'Staff member';
  if (profile?.photoUrl && profile?.id) {
    return <img src={`/api/admin/staff/${encodeURIComponent(profile.id)}/avatar`} alt={`${label} profile`} className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  const initials = String(label).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'S';
  return <span className={`${size} grid shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600`}>{initials}</span>;
}

function conversationProfile(item: Conversation, actorProfileId: string | null) {
  return item.kind === 'DIRECT'
    ? item.members.find((member) => member.profileId !== actorProfileId)?.profile || null
    : null;
}

function displayTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function AdminCommunicationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    startCall: startPersistentCall,
    callHistory,
    refreshCommunications,
  } = useStaffCommunications();
  const requestedStaffId = searchParams?.get('staffId') ?? null;
  const requestedCall = searchParams?.get('call') ?? null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [actorProfileId, setActorProfileId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>('');
  const [detail, setDetail] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newMode, setNewMode] = useState<'DIRECT' | 'GROUP'>('DIRECT');
  const [conversationQuery, setConversationQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  async function requireOk(response: Response, json: any, fallback: string) {
    if (response.ok && json?.ok) return json;
    const facing = userFacingApiError({ response, json, fallback });
    throw new Error(errorText(facing));
  }

  async function loadList() {
    const response = await fetch('/api/admin/communications/conversations', { cache: 'no-store' });
    const json = await response.json().catch(() => null);
    await requireOk(response, json, 'Unable to load conversations.');
    setConversations(json.conversations || []);
    setActorProfileId(json.actorProfileId || null);
    if (!activeId && json.conversations?.length) setActiveId(json.conversations[0].id);
  }

  async function loadStaff() {
    const response = await fetch('/api/admin/staff?page=1&pageSize=100', { cache: 'no-store' });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) return;
    setStaff((json.items || []).filter((item: any) => item.kind === 'staff'));
  }

  async function loadDetail(id: string) {
    if (!id) {
      setDetail(null);
      return;
    }
    const response = await fetch(`/api/admin/communications/conversations/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    const json = await response.json().catch(() => null);
    await requireOk(response, json, 'Unable to load this conversation.');
    setDetail(json);
    setConversations((items) => items.map((item) => item.id === id ? { ...item, unread: false, unreadCount: 0 } : item));
  }

  async function refresh() {
    setBusy(true);
    setError('');
    try {
      await Promise.all([loadList(), loadStaff(), refreshCommunications()]);
      if (activeId) await loadDetail(activeId);
    } catch (err: any) {
      setError(err?.message || 'Unable to refresh communications');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadDetail(activeId).catch((err) => setError(err?.message || 'Unable to load conversation'));
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(() => {
      void Promise.all([loadList(), loadDetail(activeId), refreshCommunications()]).catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [detail?.messages?.length, activeId]);

  useEffect(() => {
    if (!requestedStaffId || !staff.length) return;
    const target = staff.find((item) => item.id === requestedStaffId);
    if (!target) return;
    void createDirect(requestedStaffId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedStaffId, staff.length]);

  async function createDirect(profileId?: string) {
    const targetId = profileId || selectedStaffIds[0];
    if (!targetId) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/communications/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'DIRECT', profileIds: [targetId] }),
      });
      const json = await response.json().catch(() => null);
      await requireOk(response, json, 'Unable to start this conversation.');
      setActiveId(json.conversation.id);
      setSelectedStaffIds([]);
      await loadList();
      await loadDetail(json.conversation.id);
      if (requestedCall === 'audio' || requestedCall === 'video') {
        await startCallFor(json.conversation.id, requestedCall === 'audio' ? 'AUDIO' : 'VIDEO');
        return;
      }
      if (requestedStaffId) router.replace('/admin/communications');
    } catch (err: any) {
      setError(err?.message || 'Unable to create direct conversation');
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    if (!groupTitle.trim() || !selectedStaffIds.length) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/communications/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'GROUP',
          title: groupTitle.trim(),
          profileIds: selectedStaffIds,
        }),
      });
      const json = await response.json().catch(() => null);
      await requireOk(response, json, 'Unable to create this group conversation.');
      setActiveId(json.conversation.id);
      setGroupTitle('');
      setSelectedStaffIds([]);
      await loadList();
      await loadDetail(json.conversation.id);
    } catch (err: any) {
      setError(err?.message || 'Unable to create group conversation');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!activeId || !message.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/communications/conversations/${encodeURIComponent(activeId)}/messages`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: message.trim() }),
        },
      );
      const json = await response.json().catch(() => null);
      await requireOk(response, json, 'Unable to send this message.');
      setMessage('');
      await Promise.all([loadDetail(activeId), loadList()]);
    } catch (err: any) {
      setError(err?.message || 'Unable to send message');
    } finally {
      setBusy(false);
    }
  }

  async function startCallFor(conversationId: string, mode: 'AUDIO' | 'VIDEO') {
    await startPersistentCall(conversationId, mode);
    await Promise.all([loadList(), refreshCommunications()]);
  }

  async function startCall(mode: 'AUDIO' | 'VIDEO') {
    if (!activeId) return;
    setBusy(true);
    setError('');
    try {
      await startCallFor(activeId, mode);
    } catch (err: any) {
      setError(err?.message || 'Unable to start call');
    } finally {
      setBusy(false);
    }
  }

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) || detail?.conversation || null,
    [conversations, activeId, detail],
  );

  const visibleConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) => {
      const title = displayConversation(item, actorProfileId);
      const latest = item.latestMessage?.body || '';
      return `${title} ${latest}`.toLowerCase().includes(query);
    });
  }, [conversations, conversationQuery, actorProfileId]);

  return (
    <main className="space-y-5 p-4 lg:p-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Enterprise communications</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Staff messages & calls</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Message colleagues individually or in groups, and start audio or video calls from the same workspace.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <section className="grid min-h-[680px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Conversations</h2>
            <MessageSquare className="h-4 w-4 text-slate-400" />
          </div>

          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} placeholder="Search conversations" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm" />
          </label>

          <div className="mt-3 space-y-2">
            {visibleConversations.length === 0 ? <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">{conversations.length ? 'No matching conversations.' : 'No conversations yet.'}</div> : null}
            {visibleConversations.map((item) => {
              const otherProfile = conversationProfile(item, actorProfileId);
              return (
                <button key={item.id} type="button" onClick={() => setActiveId(item.id)} className={`w-full rounded-2xl border p-3 text-left ${activeId === item.id ? 'border-cyan-300 bg-cyan-50' : 'bg-white hover:bg-slate-50'}`}>
                  <div className="flex items-start gap-3">
                    {item.kind === 'DIRECT' ? <StaffAvatar profile={otherProfile} /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><Users className="h-4 w-4" /></span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{displayConversation(item, actorProfileId)}</div>
                        <div className="flex items-center gap-2">
                          {item.unreadCount ? <span className="min-w-5 rounded-full bg-cyan-700 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">{item.unreadCount > 99 ? '99+' : item.unreadCount}</span> : null}
                          <span className="text-[10px] uppercase text-slate-400">{item.kind === 'DIRECT' ? '1:1' : 'Group'}</span>
                        </div>
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">{item.latestMessage?.body || 'No messages yet'}</div>
                      <div className="mt-1 text-[10px] text-slate-400">{displayTime(item.lastMessageAt || item.latestMessage?.createdAt)}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t pt-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => setNewMode('DIRECT')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${newMode === 'DIRECT' ? 'bg-slate-950 text-white' : 'border'}`}>Direct</button>
              <button type="button" onClick={() => setNewMode('GROUP')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${newMode === 'GROUP' ? 'bg-slate-950 text-white' : 'border'}`}>Group</button>
            </div>
            {newMode === 'GROUP' ? <input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="Group title" className="mt-3 w-full rounded-xl border px-3 py-2 text-sm" /> : null}
            <select
              multiple={newMode === 'GROUP'}
              value={selectedStaffIds}
              onChange={(event) => setSelectedStaffIds(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
              className="mt-3 min-h-28 w-full rounded-xl border px-2 py-2 text-sm"
            >
              <option value="" disabled={newMode === 'DIRECT'}>Select staff</option>
              {staff.filter((item) => item.id !== actorProfileId).map((item) => <option key={item.id} value={item.id}>{item.name || item.email}</option>)}
            </select>
            <button type="button" onClick={() => newMode === 'DIRECT' ? createDirect() : createGroup()} disabled={busy || !selectedStaffIds.length || (newMode === 'GROUP' && !groupTitle.trim())} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
              <Plus className="h-4 w-4" /> {newMode === 'DIRECT' ? 'Start conversation' : 'Create group'}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col rounded-3xl border bg-white shadow-sm">
          {activeConversation && detail?.conversation ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                <div className="flex items-center gap-3">
                  {detail.conversation.kind === 'DIRECT' ? <StaffAvatar profile={conversationProfile(detail.conversation, actorProfileId)} size="h-10 w-10" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600"><Users className="h-4 w-4" /></span>}
                  <div>
                    <div className="text-lg font-semibold">{displayConversation(detail.conversation, actorProfileId)}</div>
                    <div className="mt-1 text-xs text-slate-500">{detail.conversation.kind === 'DIRECT'
                      ? (() => { const profile = conversationProfile(detail.conversation, actorProfileId); const presence = String(profile?.presence?.state || 'OFFLINE').replaceAll('_', ' ').toLowerCase(); return `${profile?.designation?.name || profile?.department?.name || 'Staff'} · ${presence}`; })()
                      : detail.conversation.members?.map((member: any) => member.profile.name || member.profile.email).join(', ')}</div>
                  </div>
                </div>
                {detail.conversation.kind === 'DIRECT' ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startCall('AUDIO')} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><Phone className="h-4 w-4" /> Audio</button>
                    <button type="button" onClick={() => startCall('VIDEO')} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm text-white"><Video className="h-4 w-4" /> Video</button>
                  </div>
                ) : <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500"><Users className="h-4 w-4" /> Group conversation</div>}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {(detail.messages || []).map((item: any) => {
                  const mine = item.senderProfileId === actorProfileId;
                  return <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 ${mine ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}><div className={`text-[10px] font-semibold uppercase tracking-wide ${mine ? 'text-white/60' : 'text-slate-400'}`}>{mine ? 'You' : item.senderProfile?.name || item.senderProfile?.email}</div><div className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.body}</div><div className={`mt-1 text-[10px] ${mine ? 'text-white/50' : 'text-slate-400'}`}>{displayTime(item.createdAt)}</div></div></div>;
                })}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>

              <form onSubmit={sendMessage} className="flex gap-2 border-t p-4">
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message" className="min-h-12 flex-1 resize-none rounded-xl border px-3 py-2 text-sm" />
                <button type="submit" disabled={busy || !message.trim()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Send className="h-4 w-4" /> Send</button>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-slate-500">Select or create a conversation.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">Recent calls</h2>
            <p className="mt-1 text-xs text-slate-500">Missed, declined, busy and completed audio/video calls appear here automatically.</p>
          </div>
        </div>
        <div className="mt-4 divide-y">
          {callHistory.length === 0 ? <div className="py-4 text-sm text-slate-500">No recent calls.</div> : null}
          {callHistory.slice(0, 15).map((call: any) => (
            <div key={call.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className={`grid h-9 w-9 place-items-center rounded-full ${call.outcome === 'MISSED' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>{call.mode === 'VIDEO' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}</span>
                <div>
                  <div className="font-medium text-slate-900">{call.other?.name || call.other?.email || 'Staff member'}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{call.isCaller ? 'Outgoing' : 'Incoming'} · {String(call.outcome || 'ended').replaceAll('_', ' ').toLowerCase()}</div>
                </div>
              </div>
              <div className="text-xs text-slate-400">{displayTime(call.createdAt)}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function AdminCommunicationsPage() {
  return (
    <Suspense fallback={null}>
      <AdminCommunicationsPageContent />
    </Suspense>
  );
}
