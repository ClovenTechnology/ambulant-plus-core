export type InviteQuoteLite = {
  id: string;
  status: 'REQUESTED' | 'APPROVED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
  totalMinor: number;
  currency: string;
};

export type CollaborativeDraftLite = {
  id: string;
  status: 'DRAFT' | 'QUOTED' | 'APPROVED' | 'DECLINED' | 'BOOKED' | 'EXPIRED' | 'CANCELLED';
  totalMinor: number;
  currency: string;
};

export type SessionHydrationState = {
  inviteQuotes: InviteQuoteLite[];
  collaborativeDrafts: CollaborativeDraftLite[];
  appointmentParticipants?: unknown[];
  participantJoinLinks?: unknown[];
};

export async function loadSessionHydration(args: {
  sessionId?: string | null;
}): Promise<SessionHydrationState> {
  if (!args.sessionId) {
    return {
      inviteQuotes: [],
      collaborativeDrafts: [],
      appointmentParticipants: [],
      participantJoinLinks: [],
    };
  }

  const [quotesRes, draftsRes] = await Promise.all([
    fetch(`/api/consultation-sessions/${encodeURIComponent(args.sessionId)}/invite-quotes`, {
      cache: 'no-store',
    }).then((r) => r.json().catch(() => ({ ok: false }))),
    fetch(`/api/consultation-sessions/${encodeURIComponent(args.sessionId)}/collaborative-drafts`, {
      cache: 'no-store',
    }).then((r) => r.json().catch(() => ({ ok: false }))),
  ]);

  return {
    inviteQuotes: Array.isArray(quotesRes?.quotes) ? quotesRes.quotes : [],
    collaborativeDrafts: Array.isArray(draftsRes?.drafts) ? draftsRes.drafts : [],
    appointmentParticipants: [],
    participantJoinLinks: [],
  };
}

export function computeSessionHydrationBlockers(state: SessionHydrationState) {
  const pendingInvite = state.inviteQuotes.find((q) => q.status === 'REQUESTED') || null;
  const pendingDraft = state.collaborativeDrafts.find(
    (d) => d.status === 'DRAFT' || d.status === 'QUOTED',
  ) || null;

  return {
    pendingInvite,
    pendingDraft,
    hasBlockingFinancialDecision: Boolean(pendingInvite || pendingDraft),
  };
}