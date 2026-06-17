'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DataPacket_Kind } from 'livekit-client';

import type {
  InvitedClinicianInput,
  MultipartyQuote,
} from '@/src/lib/televisit/multiparty';
import type { RoomParty } from '@/src/lib/rtc/roster-contract';
import {
  buildPaymentRequestMessage,
  parsePaymentResponseMessage,
} from '@/src/lib/televisit/payment-messages';

type ToastLevel = 'success' | 'warning' | 'error' | 'info';
type PushToast = (message: string, tone?: ToastLevel, title?: string) => void;

type PublishTopic = (
  topic: string,
  payload: unknown,
  kind?: DataPacket_Kind,
) => Promise<void>;

type PublishRoster = (payload: unknown) => Promise<void>;

type Options = {
  roomId: string;
  sessionId?: string | null;
  appointmentId?: string | null;
  encounterId?: string | null;
  publishTopic: PublishTopic;
  publishRoster: PublishRoster;
  pushToast: PushToast;
  setRoster: React.Dispatch<React.SetStateAction<RoomParty[]>>;
  topicChat: string;
  reliableKind: DataPacket_Kind;
};

export type PendingInviteQuote = {
  invitedClinicians: InvitedClinicianInput[];
  quoteId: string;
  totalZar: number;
  sessionId?: string | null;
  appointmentId?: string | null;
  encounterId?: string | null;
  status?: 'REQUESTED' | 'APPROVED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
};

type InviteConfirmPayload = {
  invitedClinicians: InvitedClinicianInput[];
  quote: MultipartyQuote;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function parseInvitedClinicians(input: unknown): InvitedClinicianInput[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!isRecord(item)) return null;

      const clinicianId =
        typeof item.clinicianId === 'string' ? item.clinicianId.trim() : '';
      if (!clinicianId) return null;

      const role =
        item.role === 'advisor' ||
        item.role === 'co_clinician' ||
        item.role === 'takeover_followup'
          ? item.role
          : 'advisor';

      return {
        clinicianId,
        displayName:
          typeof item.displayName === 'string' ? item.displayName : undefined,
        specialty:
          typeof item.specialty === 'string' ? item.specialty : undefined,
        role,
        standardConsultFeeZar:
          typeof item.standardConsultFeeZar === 'number' &&
          Number.isFinite(item.standardConsultFeeZar)
            ? item.standardConsultFeeZar
            : 0,
        followUpFeeZar:
          typeof item.followUpFeeZar === 'number' &&
          Number.isFinite(item.followUpFeeZar)
            ? item.followUpFeeZar
            : undefined,
        expectedMinutes:
          typeof item.expectedMinutes === 'number' &&
          Number.isFinite(item.expectedMinutes)
            ? item.expectedMinutes
            : undefined,
        required: item.required !== false,
      } satisfies InvitedClinicianInput;
    })
    .filter(Boolean) as InvitedClinicianInput[];
}

function applyRosterState(
  prev: RoomParty[],
  partyIds: string[],
  nextState: RoomParty['state'],
): RoomParty[] {
  return prev.map((party) =>
    partyIds.includes(party.partyId)
      ? { ...party, state: nextState }
      : party,
  );
}

type ApiInviteQuoteLine = {
  clinicianId: string;
  role: 'ADVISOR' | 'CO_CLINICIAN' | 'TAKEOVER_FOLLOWUP';
  specialty?: string | null;
  required?: boolean;
  amountMinor: number;
};

type ApiInviteQuote = {
  id: string;
  status: 'REQUESTED' | 'APPROVED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
  totalMinor: number;
  currency: string;
  consultationSessionId: string;
  appointmentId: string;
  encounterId?: string | null;
  lines?: ApiInviteQuoteLine[];
};

function mapApiQuoteToPending(
  quote: ApiInviteQuote,
): PendingInviteQuote {
  const invitedClinicians = Array.isArray(quote.lines)
    ? quote.lines
        .filter((line) => line.specialty !== 'orchestration')
        .map((line) => ({
          clinicianId: line.clinicianId,
          displayName: undefined,
          specialty: line.specialty ?? undefined,
          role:
            line.role === 'ADVISOR'
              ? 'advisor'
              : line.role === 'CO_CLINICIAN'
                ? 'co_clinician'
                : 'takeover_followup',
          standardConsultFeeZar: Number((line.amountMinor || 0) / 100),
          followUpFeeZar: undefined,
          expectedMinutes: undefined,
          required: line.required !== false,
        }))
    : [];

  return {
    quoteId: quote.id,
    totalZar: Number((quote.totalMinor || 0) / 100),
    invitedClinicians: invitedClinicians as InvitedClinicianInput[],
    sessionId: quote.consultationSessionId,
    appointmentId: quote.appointmentId,
    encounterId: quote.encounterId ?? null,
    status: quote.status,
  };
}

export function useInviteSpecialistApproval({
  roomId,
  sessionId,
  appointmentId,
  encounterId,
  publishTopic,
  publishRoster,
  pushToast,
  setRoster,
  topicChat,
  reliableKind,
}: Options) {
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [pendingInviteQuote, setPendingInviteQuote] =
    useState<PendingInviteQuote | null>(null);
  const [loadingPersistedQuote, setLoadingPersistedQuote] = useState(false);

  const dismissPendingInviteQuote = useCallback(() => {
    setPendingInviteQuote(null);
  }, []);

  const openInviteDrawer = useCallback(() => {
    setInviteDrawerOpen(true);
  }, []);

  const closeInviteDrawer = useCallback(() => {
    setInviteDrawerOpen(false);
  }, []);

  const hydrateLatestRequestedQuote = useCallback(async () => {
    if (!sessionId) return;

    setLoadingPersistedQuote(true);
    try {
      const res = await fetch(
        `/api/consultation-sessions/${encodeURIComponent(sessionId)}/invite-quotes`,
        { cache: 'no-store' },
      );
      const js = await res.json().catch(() => ({} as any));

      if (!res.ok || js.ok === false) {
        throw new Error(js.error || 'failed_to_load_invite_quotes');
      }

      const quotes: ApiInviteQuote[] = Array.isArray(js.quotes) ? js.quotes : [];
      const latestRequested = quotes.find((q) => q.status === 'REQUESTED');

      if (latestRequested) {
        setPendingInviteQuote(mapApiQuoteToPending(latestRequested));
      } else {
        setPendingInviteQuote(null);
      }
    } catch (err) {
      console.error('[useInviteSpecialistApproval] hydrate error', err);
    } finally {
      setLoadingPersistedQuote(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void hydrateLatestRequestedQuote();
  }, [hydrateLatestRequestedQuote]);

  const confirmInvite = useCallback(
    async ({ invitedClinicians }: InviteConfirmPayload) => {
      if (!sessionId) {
        throw new Error('consultation_session_required_for_live_specialist_invite');
      }

      const res = await fetch(
        `/api/consultation-sessions/${encodeURIComponent(sessionId)}/invite-quotes`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            intent: 'LIVE_JOIN_NOW',
            invitedClinicians: invitedClinicians.map((c) => ({
              clinicianId: c.clinicianId,
              role: c.role,
              specialty: c.specialty ?? null,
              required: c.required !== false,
            })),
          }),
        },
      );

      const js = await res.json().catch(() => ({} as any));
      if (!res.ok || js.ok === false || !js.quote) {
        throw new Error(js.error || 'failed_to_create_invite_quote');
      }

      const apiQuote = js.quote as ApiInviteQuote;
      const pending = mapApiQuoteToPending(apiQuote);

      const inviteParty = pending.invitedClinicians[0]
        ? {
            partyId: `clin-${pending.invitedClinicians[0].clinicianId}`,
            role:
              pending.invitedClinicians[0].role === 'advisor'
                ? 'advisor'
                : 'co_clinician',
            displayName:
              pending.invitedClinicians[0].displayName ||
              pending.invitedClinicians[0].specialty ||
              'Invited clinician',
            required: pending.invitedClinicians[0].required !== false,
            clinicianId: pending.invitedClinicians[0].clinicianId,
            specialty: pending.invitedClinicians[0].specialty ?? null,
            state: 'invited' as const,
          }
        : undefined;

      if (inviteParty) {
        setRoster((prev) => {
          const others = prev.filter((x) => x.partyId !== inviteParty.partyId);
          return [...others, inviteParty];
        });

        await publishRoster({
          type: 'roster.party.invited',
          roomId,
          party: inviteParty,
          ts: Date.now(),
        });
      }

      setPendingInviteQuote(pending);

      pushToast(
        'Specialist invite persisted and awaiting patient approval.',
        'success',
        'Invite Specialist',
      );

      setInviteDrawerOpen(false);

      await publishTopic(
        topicChat,
        buildPaymentRequestMessage({
          quoteId: pending.quoteId,
          totalZar: pending.totalZar,
          invitedClinicians: pending.invitedClinicians,
          session: {
            roomId,
            sessionId: pending.sessionId ?? sessionId,
            appointmentId: pending.appointmentId ?? appointmentId,
            encounterId: pending.encounterId ?? encounterId,
          },
        }),
        reliableKind,
      );
    },
    [
      appointmentId,
      encounterId,
      publishRoster,
      publishTopic,
      pushToast,
      reliableKind,
      roomId,
      sessionId,
      setRoster,
      topicChat,
    ],
  );

  const handleIncomingChatPayload = useCallback(
    async (parsed: unknown) => {
      const paymentResponse = parsePaymentResponseMessage(parsed);
      if (!paymentResponse) return false;

      const approved = paymentResponse.approved;
      const quoteId = paymentResponse.quoteId;
      const invitedClinicians = paymentResponse.invitedClinicians;

      if (sessionId && quoteId) {
        try {
          const action = approved ? 'approve' : 'decline';
          const res = await fetch(
            `/api/consultation-sessions/${encodeURIComponent(sessionId)}/invite-quotes/${encodeURIComponent(quoteId)}/${action}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({}),
            },
          );
          const js = await res.json().catch(() => ({} as any));
          if (!res.ok || js.ok === false) {
            throw new Error(js.error || `failed_to_${action}_invite_quote`);
          }
        } catch (err) {
          console.error('[useInviteSpecialistApproval] approval sync error', err);
          pushToast(
            approved
              ? 'Patient approved live quote, but backend sync failed.'
              : 'Patient declined live quote, but backend sync failed.',
            'warning',
            'Invite Quote Sync',
          );
        }
      }

      if (approved) {
        pushToast(
          quoteId
            ? `Patient approved specialist add-on (${quoteId}).`
            : 'Patient approved specialist add-on.',
          'success',
          'Payment approved',
        );

        setPendingInviteQuote(null);

        const approvedParties = invitedClinicians.map(
          (c) => `clin-${c.clinicianId}`,
        );

        setRoster((prev) =>
          applyRosterState(prev, approvedParties, 'accepted'),
        );

        for (const c of invitedClinicians) {
          await publishRoster({
            type: 'roster.party.joined',
            roomId,
            party: {
              partyId: `clin-${c.clinicianId}`,
              role: c.role === 'advisor' ? 'advisor' : 'co_clinician',
              displayName: c.displayName || c.specialty || 'Invited clinician',
              required: c.required !== false,
              clinicianId: c.clinicianId,
              specialty: c.specialty ?? null,
              state: 'accepted',
              joinedAt: Date.now(),
            },
            ts: Date.now(),
          });
        }
      } else {
        pushToast(
          quoteId
            ? `Patient declined specialist add-on (${quoteId}).`
            : 'Patient declined specialist add-on.',
          'warning',
          'Payment declined',
        );

        const declinedParties = invitedClinicians.map(
          (c) => `clin-${c.clinicianId}`,
        );

        setRoster((prev) =>
          applyRosterState(prev, declinedParties, 'declined'),
        );

        setPendingInviteQuote(null);
      }

      return true;
    },
    [publishRoster, pushToast, roomId, sessionId, setRoster],
  );

  return {
    inviteDrawerOpen,
    setInviteDrawerOpen,
    openInviteDrawer,
    closeInviteDrawer,
    pendingInviteQuote,
    dismissPendingInviteQuote,
    confirmInvite,
    handleIncomingChatPayload,
    loadingPersistedQuote,
    hydrateLatestRequestedQuote,
  };
}

export default useInviteSpecialistApproval;

