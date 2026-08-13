'use client';

import {
  Fragment,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  Clock3,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useStaffCommunications } from '@/components/StaffCommunicationsProvider';
import {
  CALLABLE_PARTY_KINDS,
  staffAsCallableParty,
  type CallablePartyKind,
} from '@/lib/communications-parties';
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

type ConversationFilter = 'ALL' | 'DIRECT' | 'GROUP';

function displayConversation(
  item: Conversation,
  actorProfileId: string | null,
) {
  if (item.kind === 'GROUP') return item.title || 'Group';
  const other = item.members.find(
    (member) => member.profileId !== actorProfileId,
  )?.profile;
  return other?.name || other?.email || 'Direct conversation';
}

function conversationProfile(
  item: Conversation,
  actorProfileId: string | null,
) {
  if (item.kind !== 'DIRECT') return null;
  return (
    item.members.find(
      (member) => member.profileId !== actorProfileId,
    )?.profile || null
  );
}

function initials(value: string) {
  return (
    String(value)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'A'
  );
}

function StaffAvatar({
  profile,
  size = 'h-10 w-10',
}: {
  profile: any;
  size?: string;
}) {
  const label = profile?.name || profile?.email || 'Staff member';

  if (profile?.photoUrl && profile?.id) {
    return (
      <img
        src={`/api/admin/staff/${encodeURIComponent(profile.id)}/avatar`}
        alt={`${label} profile`}
        className={`${size} shrink-0 rounded-2xl object-cover`}
      />
    );
  }

  return (
    <span
      className={`${size} grid shrink-0 place-items-center rounded-2xl bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200`}
    >
      {initials(label)}
    </span>
  );
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

function displayClock(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function dayLabel(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diff = Math.round(
    (today.getTime() - target.getTime()) / 86_400_000,
  );

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year:
      target.getFullYear() === today.getFullYear()
        ? undefined
        : 'numeric',
  }).format(target);
}

function presenceLabel(value: unknown) {
  const state = String(value || 'OFFLINE').toUpperCase();
  const labels: Record<string, string> = {
    AVAILABLE: 'Available',
    BUSY: 'Busy',
    IN_MEETING: 'In meeting',
    DO_NOT_DISTURB: 'Do not disturb',
    OFFLINE: 'Offline',
  };
  return labels[state] || state.replaceAll('_', ' ').toLowerCase();
}

function presenceDot(value: unknown) {
  const state = String(value || 'OFFLINE').toUpperCase();
  if (state === 'AVAILABLE') return 'bg-emerald-500';
  if (state === 'BUSY') return 'bg-amber-500';
  if (state === 'IN_MEETING') return 'bg-blue-500';
  if (state === 'DO_NOT_DISTURB') return 'bg-rose-500';
  return 'bg-slate-300';
}

function callOutcomeLabel(value: unknown) {
  const state = String(value || 'ENDED').toUpperCase();
  const labels: Record<string, string> = {
    COMPLETED: 'Completed',
    MISSED: 'Missed',
    DECLINED: 'Declined',
    BUSY: 'Busy',
    CANCELLED: 'Cancelled',
    FAILED: 'Failed',
  };
  return labels[state] || state.replaceAll('_', ' ').toLowerCase();
}

function callOutcomeTone(value: unknown) {
  const state = String(value || '').toUpperCase();
  if (state === 'MISSED' || state === 'FAILED') {
    return 'bg-rose-50 text-rose-600';
  }
  if (state === 'COMPLETED') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (state === 'BUSY' || state === 'DECLINED') {
    return 'bg-amber-50 text-amber-700';
  }
  return 'bg-slate-100 text-slate-600';
}

function AdminCommunicationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    startCall: startPersistentCall,
    callHistory,
    currentCall,
    callBusy,
    refreshCommunications,
  } = useStaffCommunications();

  const requestedStaffId = searchParams?.get('staffId') ?? null;
  const requestedCall = searchParams?.get('call') ?? null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [actorProfileId, setActorProfileId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newMode, setNewMode] = useState<'DIRECT' | 'GROUP'>('DIRECT');
  const [conversationQuery, setConversationQuery] = useState('');
  const [conversationFilter, setConversationFilter] =
    useState<ConversationFilter>('ALL');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationQuery, setNewConversationQuery] = useState('');
  const [partyKind, setPartyKind] =
    useState<CallablePartyKind>('STAFF');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  async function requireOk(
    response: Response,
    json: any,
    fallback: string,
  ) {
    if (response.ok && json?.ok) return json;
    const facing = userFacingApiError({
      response,
      json,
      fallback,
    });
    throw new Error(errorText(facing));
  }

  async function loadList() {
    const response = await fetch(
      '/api/admin/communications/conversations',
      { cache: 'no-store' },
    );
    const json = await response.json().catch(() => null);

    await requireOk(
      response,
      json,
      'Unable to load conversations.',
    );

    setConversations(json.conversations || []);
    setActorProfileId(json.actorProfileId || null);

    if (!activeId && json.conversations?.length) {
      setActiveId(json.conversations[0].id);
    }
  }

  async function loadStaff() {
    const response = await fetch(
      '/api/admin/staff?page=1&pageSize=100',
      { cache: 'no-store' },
    );
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) return;

    setStaff(
      (json.items || []).filter(
        (item: any) => item.kind === 'staff',
      ),
    );
  }

  async function loadDetail(id: string) {
    if (!id) {
      setDetail(null);
      return;
    }

    const response = await fetch(
      `/api/admin/communications/conversations/${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    );
    const json = await response.json().catch(() => null);

    await requireOk(
      response,
      json,
      'Unable to load this conversation.',
    );

    setDetail(json);
    setConversations((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, unread: false, unreadCount: 0 }
          : item,
      ),
    );
  }

  async function refresh() {
    setBusy(true);
    setError('');

    try {
      await Promise.all([
        loadList(),
        loadStaff(),
        refreshCommunications(),
      ]);

      if (activeId) {
        await loadDetail(activeId);
      }
    } catch (err: any) {
      setError(
        err?.message || 'Unable to refresh communications',
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    void loadDetail(activeId).catch((err) =>
      setError(
        err?.message || 'Unable to load conversation',
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;

    const timer = window.setInterval(() => {
      void Promise.all([
        loadList(),
        loadDetail(activeId),
      ]).catch(() => undefined);
    }, 2500);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [detail?.messages?.length, activeId]);

  useEffect(() => {
    if (!requestedStaffId || !staff.length) return;

    const target = staff.find(
      (item) => item.id === requestedStaffId,
    );
    if (!target) return;

    void createDirect(requestedStaffId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedStaffId, staff.length]);

  async function createDirect(profileId?: string) {
    const targetId =
      profileId || selectedStaffIds[0];

    if (!targetId) return;

    if (targetId === actorProfileId) {
      setError(
        'You cannot start a direct conversation or call with yourself.',
      );
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        '/api/admin/communications/conversations',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            kind: 'DIRECT',
            profileIds: [targetId],
          }),
        },
      );

      const json = await response.json().catch(() => null);

      await requireOk(
        response,
        json,
        'Unable to start this conversation.',
      );

      setActiveId(json.conversation.id);
      setSelectedStaffIds([]);
      setShowNewConversation(false);
      setNewConversationQuery('');

      await loadList();
      await loadDetail(json.conversation.id);

      if (
        requestedCall === 'audio' ||
        requestedCall === 'video'
      ) {
        await startCallFor(
          json.conversation.id,
          requestedCall === 'audio'
            ? 'AUDIO'
            : 'VIDEO',
        );
        return;
      }

      if (requestedStaffId) {
        router.replace('/admin/communications');
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to create direct conversation',
      );
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    if (
      !groupTitle.trim() ||
      !selectedStaffIds.length
    ) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        '/api/admin/communications/conversations',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            kind: 'GROUP',
            title: groupTitle.trim(),
            profileIds: selectedStaffIds,
          }),
        },
      );

      const json = await response.json().catch(() => null);

      await requireOk(
        response,
        json,
        'Unable to create this group conversation.',
      );

      setActiveId(json.conversation.id);
      setGroupTitle('');
      setSelectedStaffIds([]);
      setShowNewConversation(false);
      setNewConversationQuery('');

      await loadList();
      await loadDetail(json.conversation.id);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to create group conversation',
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (!activeId || !message.trim()) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        `/api/admin/communications/conversations/${encodeURIComponent(activeId)}/messages`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            body: message.trim(),
          }),
        },
      );

      const json = await response.json().catch(() => null);

      await requireOk(
        response,
        json,
        'Unable to send this message.',
      );

      setMessage('');

      await Promise.all([
        loadDetail(activeId),
        loadList(),
      ]);
    } catch (err: any) {
      setError(
        err?.message || 'Unable to send message',
      );
    } finally {
      setBusy(false);
    }
  }

  async function startCallFor(
    conversationId: string,
    mode: 'AUDIO' | 'VIDEO',
  ) {
    await startPersistentCall(
      conversationId,
      mode,
    );
    await loadList();
  }

  async function startCall(
    mode: 'AUDIO' | 'VIDEO',
  ) {
    if (!activeId) return;

    setBusy(true);
    setError('');

    try {
      await startCallFor(activeId, mode);
    } catch (err: any) {
      setError(
        err?.message || 'Unable to start call',
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleStaffSelection(id: string) {
    if (id === actorProfileId) return;

    if (newMode === 'DIRECT') {
      setSelectedStaffIds([id]);
      return;
    }

    setSelectedStaffIds((items) =>
      items.includes(id)
        ? items.filter((item) => item !== id)
        : [...items, id],
    );
  }

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (item) => item.id === activeId,
      ) ||
      detail?.conversation ||
      null,
    [conversations, activeId, detail],
  );

  const activeProfile = useMemo(
    () =>
      activeConversation?.kind === 'DIRECT'
        ? conversationProfile(
            activeConversation,
            actorProfileId,
          )
        : null,
    [activeConversation, actorProfileId],
  );

  const visibleConversations = useMemo(() => {
    const query =
      conversationQuery.trim().toLowerCase();

    return conversations.filter((item) => {
      if (
        conversationFilter !== 'ALL' &&
        item.kind !== conversationFilter
      ) {
        return false;
      }

      if (!query) return true;

      const title = displayConversation(
        item,
        actorProfileId,
      );
      const latest =
        item.latestMessage?.body || '';

      return `${title} ${latest}`
        .toLowerCase()
        .includes(query);
    });
  }, [
    conversations,
    conversationFilter,
    conversationQuery,
    actorProfileId,
  ]);

  const availableStaff = useMemo(() => {
    const query =
      newConversationQuery.trim().toLowerCase();

    return staff
      .filter(
        (item) => item.id !== actorProfileId,
      )
      .map(staffAsCallableParty)
      .filter((party) => {
        if (!query) return true;
        return `${party.displayName} ${party.subtitle || ''} ${party.email || ''}`
          .toLowerCase()
          .includes(query);
      });
  }, [
    staff,
    actorProfileId,
    newConversationQuery,
  ]);

  const activeCallExists = Boolean(
    currentCall &&
      ['RINGING', 'LIVE'].includes(
        String(currentCall.state || ''),
      ),
  );

  return (
    <main className="min-h-[720px] bg-slate-50/60 p-3 lg:h-[calc(100vh-4.5rem)] lg:p-4">
      <section className="mx-auto flex h-full max-w-[1800px] flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_24px_80px_-50px_rgba(15,23,42,0.45)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white">
              <MessageCircle className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                  Communications
                </h1>
                <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                  Realtime
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Messages, voice and video in one governed workspace.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setShowNewConversation(true)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New conversation
            </button>

            <button
              type="button"
              onClick={() => void refresh()}
              disabled={busy}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              aria-label="Refresh communications"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  busy ? 'animate-spin' : ''
                }`}
              />
            </button>
          </div>
        </header>

        {error ? (
          <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[290px_minmax(0,1fr)_280px]">
          <aside className="flex min-h-0 flex-col border-r border-slate-200/80 bg-slate-50/35">
            <div className="border-b border-slate-200/70 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={conversationQuery}
                  onChange={(event) =>
                    setConversationQuery(
                      event.target.value,
                    )
                  }
                  placeholder="Search conversations"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div className="mt-3 flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                {[
                  ['ALL', 'All'],
                  ['DIRECT', 'Direct'],
                  ['GROUP', 'Groups'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setConversationFilter(
                        value as ConversationFilter,
                      )
                    }
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                      conversationFilter === value
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {visibleConversations.length === 0 ? (
                <div className="m-2 rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
                  {conversations.length
                    ? 'No matching conversations.'
                    : 'No conversations yet.'}
                </div>
              ) : null}

              <div className="space-y-1">
                {visibleConversations.map(
                  (item) => {
                    const profile =
                      conversationProfile(
                        item,
                        actorProfileId,
                      );
                    const presence =
                      profile?.presence?.state ||
                      'OFFLINE';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setActiveId(item.id)
                        }
                        className={`group w-full rounded-2xl px-3 py-3 text-left transition ${
                          activeId === item.id
                            ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10'
                            : 'hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            {item.kind ===
                            'DIRECT' ? (
                              <StaffAvatar
                                profile={profile}
                              />
                            ) : (
                              <span
                                className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                                  activeId ===
                                  item.id
                                    ? 'bg-white/10 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <Users className="h-4 w-4" />
                              </span>
                            )}

                            {item.kind ===
                            'DIRECT' ? (
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${
                                  activeId ===
                                  item.id
                                    ? 'border-slate-950'
                                    : 'border-white'
                                } ${presenceDot(
                                  presence,
                                )}`}
                              />
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div
                                className={`truncate text-sm font-semibold ${
                                  activeId ===
                                  item.id
                                    ? 'text-white'
                                    : 'text-slate-900'
                                }`}
                              >
                                {displayConversation(
                                  item,
                                  actorProfileId,
                                )}
                              </div>

                              {item.unreadCount ? (
                                <span className="min-w-5 rounded-full bg-cyan-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                                  {item.unreadCount >
                                  99
                                    ? '99+'
                                    : item.unreadCount}
                                </span>
                              ) : null}
                            </div>

                            <div
                              className={`mt-1 truncate text-xs ${
                                activeId === item.id
                                  ? 'text-white/55'
                                  : 'text-slate-500'
                              }`}
                            >
                              {item.latestMessage
                                ?.body ||
                                (item.kind ===
                                'DIRECT'
                                  ? presenceLabel(
                                      presence,
                                    )
                                  : 'Group conversation')}
                            </div>

                            <div
                              className={`mt-1.5 text-[10px] ${
                                activeId === item.id
                                  ? 'text-white/35'
                                  : 'text-slate-400'
                              }`}
                            >
                              {displayTime(
                                item.lastMessageAt ||
                                  item
                                    .latestMessage
                                    ?.createdAt,
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </aside>

          <section className="flex min-h-[560px] min-w-0 flex-col bg-white">
            {activeConversation &&
            detail?.conversation ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {detail.conversation
                      .kind === 'DIRECT' ? (
                      <StaffAvatar
                        profile={conversationProfile(
                          detail.conversation,
                          actorProfileId,
                        )}
                        size="h-11 w-11"
                      />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600">
                        <Users className="h-5 w-5" />
                      </span>
                    )}

                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold tracking-tight text-slate-950">
                        {displayConversation(
                          detail.conversation,
                          actorProfileId,
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        {detail.conversation
                          .kind === 'DIRECT' ? (
                          (() => {
                            const profile =
                              conversationProfile(
                                detail.conversation,
                                actorProfileId,
                              );
                            const presence =
                              profile?.presence
                                ?.state ||
                              'OFFLINE';

                            return (
                              <>
                                <span
                                  className={`h-2 w-2 rounded-full ${presenceDot(
                                    presence,
                                  )}`}
                                />
                                <span>
                                  {profile
                                    ?.designation
                                    ?.name ||
                                    profile
                                      ?.department
                                      ?.name ||
                                    'Staff'}
                                </span>
                                <span className="text-slate-300">
                                  ·
                                </span>
                                <span>
                                  {presenceLabel(
                                    presence,
                                  )}
                                </span>
                              </>
                            );
                          })()
                        ) : (
                          <span className="truncate">
                            {detail.conversation.members
                              ?.map(
                                (
                                  member: any,
                                ) =>
                                  member
                                    .profile
                                    .name ||
                                  member
                                    .profile
                                    .email,
                              )
                              .join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {detail.conversation.kind ===
                  'DIRECT' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void startCall(
                            'AUDIO',
                          )
                        }
                        disabled={
                          busy ||
                          callBusy ||
                          activeCallExists
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Phone className="h-4 w-4" />
                        Audio
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void startCall(
                            'VIDEO',
                          )
                        }
                        disabled={
                          busy ||
                          callBusy ||
                          activeCallExists
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Video className="h-4 w-4" />
                        Video
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      <Users className="h-4 w-4" />
                      Group conversation
                    </div>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-white via-white to-slate-50/60 px-5 py-5">
                  {(detail.messages || [])
                    .length === 0 ? (
                    <div className="grid h-full min-h-80 place-items-center text-center">
                      <div className="max-w-sm">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                          <MessageSquare className="h-6 w-6" />
                        </div>
                        <div className="mt-4 text-sm font-semibold text-slate-900">
                          Start the conversation
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-500">
                          Messages and call
                          history stay linked to
                          this workspace.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {(detail.messages || []).map(
                      (
                        item: any,
                        index: number,
                      ) => {
                        const mine =
                          item.senderProfileId ===
                          actorProfileId;
                        const previous =
                          index > 0
                            ? detail.messages[
                                index - 1
                              ]
                            : null;
                        const showDay =
                          !previous ||
                          dayLabel(
                            previous.createdAt,
                          ) !==
                            dayLabel(
                              item.createdAt,
                            );

                        return (
                          <Fragment
                            key={item.id}
                          >
                            {showDay ? (
                              <div className="flex items-center gap-3 py-3">
                                <div className="h-px flex-1 bg-slate-100" />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                                  {dayLabel(
                                    item.createdAt,
                                  )}
                                </span>
                                <div className="h-px flex-1 bg-slate-100" />
                              </div>
                            ) : null}

                            <div
                              className={`flex ${
                                mine
                                  ? 'justify-end'
                                  : 'justify-start'
                              }`}
                            >
                              <div
                                className={`max-w-[78%] rounded-[20px] px-4 py-3 shadow-sm ${
                                  mine
                                    ? 'rounded-br-md bg-slate-950 text-white'
                                    : 'rounded-bl-md border border-slate-100 bg-white text-slate-900'
                                }`}
                              >
                                {!mine ? (
                                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
                                    {item
                                      .senderProfile
                                      ?.name ||
                                      item
                                        .senderProfile
                                        ?.email}
                                  </div>
                                ) : null}

                                <div className="whitespace-pre-wrap text-sm leading-6">
                                  {item.body}
                                </div>

                                <div
                                  className={`mt-1.5 text-right text-[10px] ${
                                    mine
                                      ? 'text-white/40'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {displayClock(
                                    item.createdAt,
                                  )}
                                </div>
                              </div>
                            </div>
                          </Fragment>
                        );
                      },
                    )}
                  </div>

                  <div
                    ref={messagesEndRef}
                    aria-hidden="true"
                  />
                </div>

                <form
                  onSubmit={sendMessage}
                  className="border-t border-slate-200/80 bg-white p-4"
                >
                  <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-2 transition focus-within:border-cyan-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-100">
                    <textarea
                      value={message}
                      onChange={(event) =>
                        setMessage(
                          event.target.value,
                        )
                      }
                      placeholder="Write a message…"
                      className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                    />

                    <button
                      type="submit"
                      disabled={
                        busy ||
                        !message.trim()
                      }
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-700 text-white transition hover:bg-cyan-600 disabled:opacity-40"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-8 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-slate-950 text-white shadow-lg">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">
                    Ambulant+ Communications
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Select a conversation or
                    start a new one to message,
                    call or collaborate.
                  </p>
                </div>
              </div>
            )}
          </section>

          <aside className="flex min-h-0 flex-col border-l border-slate-200/80 bg-slate-50/35">
            <div className="border-b border-slate-200/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Context
              </div>

              {activeProfile ? (
                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    <StaffAvatar
                      profile={activeProfile}
                      size="h-12 w-12"
                    />

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-950">
                        {activeProfile.name ||
                          activeProfile.email}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {activeProfile
                          .designation
                          ?.name ||
                          activeProfile
                            .department
                            ?.name ||
                          'Ambulant+ staff'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        Presence
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <span
                          className={`h-2 w-2 rounded-full ${presenceDot(
                            activeProfile
                              .presence?.state,
                          )}`}
                        />
                        {presenceLabel(
                          activeProfile
                            .presence?.state,
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">
                        Channel
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-700">
                        Staff
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 truncate text-xs text-slate-500">
                    {activeProfile.email}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">
                  Select a direct conversation
                  to see contact context.
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Recent calls
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Latest call activity
                  </p>
                </div>
                <Clock3 className="h-4 w-4 text-slate-400" />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {callHistory.length === 0 ? (
                  <div className="m-2 rounded-xl border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">
                    No recent calls.
                  </div>
                ) : null}

                <div className="space-y-1">
                  {callHistory
                    .slice(0, 18)
                    .map((call: any) => (
                      <button
                        key={call.id}
                        type="button"
                        disabled={
                          !call.conversationId
                        }
                        onClick={() => {
                          if (
                            call.conversationId
                          ) {
                            setActiveId(
                              call.conversationId,
                            );
                          }
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-white disabled:cursor-default"
                      >
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${callOutcomeTone(
                            call.outcome,
                          )}`}
                        >
                          {call.mode ===
                          'VIDEO' ? (
                            <Video className="h-4 w-4" />
                          ) : (
                            <Phone className="h-4 w-4" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-slate-800">
                            {call.other
                              ?.name ||
                              call.other
                                ?.email ||
                              'Staff member'}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-slate-400">
                            {call.isCaller
                              ? 'Outgoing'
                              : 'Incoming'}{' '}
                            ·{' '}
                            {callOutcomeLabel(
                              call.outcome,
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-[10px] text-slate-400">
                          {displayClock(
                            call.createdAt,
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {showNewConversation ? (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/50 bg-white shadow-[0_30px_100px_-25px_rgba(15,23,42,0.55)]">
            <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
              <div>
                <div className="text-base font-semibold tracking-tight text-slate-950">
                  New conversation
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Choose who you want to
                  reach.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowNewConversation(
                    false,
                  )
                }
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-slate-200/70 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {CALLABLE_PARTY_KINDS.map(
                  (item) => (
                    <button
                      key={item.kind}
                      type="button"
                      disabled={!item.enabled}
                      onClick={() =>
                        item.enabled &&
                        setPartyKind(
                          item.kind,
                        )
                      }
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        partyKind ===
                        item.kind
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : item.enabled
                            ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      }`}
                    >
                      {item.label}
                      {!item.enabled ? (
                        <span className="ml-1.5 text-[9px] uppercase tracking-wide">
                          Later
                        </span>
                      ) : null}
                    </button>
                  ),
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewMode('DIRECT');
                    setSelectedStaffIds([]);
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    newMode === 'DIRECT'
                      ? 'bg-cyan-50 text-cyan-700'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Direct
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewMode('GROUP');
                    setSelectedStaffIds([]);
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                    newMode === 'GROUP'
                      ? 'bg-cyan-50 text-cyan-700'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Group
                </button>
              </div>

              {newMode === 'GROUP' ? (
                <input
                  value={groupTitle}
                  onChange={(event) =>
                    setGroupTitle(
                      event.target.value,
                    )
                  }
                  placeholder="Group title"
                  className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                />
              ) : null}

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={
                    newConversationQuery
                  }
                  onChange={(event) =>
                    setNewConversationQuery(
                      event.target.value,
                    )
                  }
                  placeholder="Search staff"
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {partyKind === 'STAFF' ? (
                <div className="space-y-1">
                  {availableStaff.map(
                    (party) => {
                      const raw =
                        staff.find(
                          (item) =>
                            item.id ===
                            party.id,
                        );
                      const selected =
                        selectedStaffIds.includes(
                          party.id,
                        );

                      return (
                        <button
                          key={party.id}
                          type="button"
                          onClick={() =>
                            toggleStaffSelection(
                              party.id,
                            )
                          }
                          className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                            selected
                              ? 'border-cyan-300 bg-cyan-50'
                              : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <StaffAvatar
                            profile={raw}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {
                                party.displayName
                              }
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                              <span
                                className={`h-2 w-2 rounded-full ${presenceDot(
                                  party.presence,
                                )}`}
                              />
                              <span>
                                {presenceLabel(
                                  party.presence,
                                )}
                              </span>
                              <span className="text-slate-300">
                                ·
                              </span>
                              <span className="truncate">
                                {party.subtitle}
                              </span>
                            </div>
                          </div>

                          <ChevronRight
                            className={`h-4 w-4 ${
                              selected
                                ? 'text-cyan-700'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      );
                    },
                  )}

                  {availableStaff.length ===
                  0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      No matching staff.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/60 px-5 py-4">
              <div className="text-xs text-slate-500">
                {selectedStaffIds.length
                  ? `${selectedStaffIds.length} selected`
                  : 'Select a staff member'}
              </div>

              <button
                type="button"
                onClick={() =>
                  newMode === 'DIRECT'
                    ? void createDirect()
                    : void createGroup()
                }
                disabled={
                  busy ||
                  !selectedStaffIds.length ||
                  (newMode === 'GROUP' &&
                    !groupTitle.trim())
                }
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
              >
                <MessageCircle className="h-4 w-4" />
                {newMode === 'DIRECT'
                  ? 'Start conversation'
                  : 'Create group'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
