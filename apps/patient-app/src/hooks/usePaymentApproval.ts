'use client';

import { useCallback, useMemo, useState } from 'react';
import type { InvitedClinicianInput } from '@/src/lib/televisit/multiparty';
import {
  buildPaymentResponseMessage,
  parsePaymentRequestMessage,
  parsePaymentResponseMessage,
} from '@/src/lib/televisit/payment-messages';

export type PendingPaymentRequest = {
  quoteId: string | null;
  totalZar: number | null;
  invitedClinicians: InvitedClinicianInput[];
  roomId?: string | null;
  sessionId?: string | null;
  appointmentId?: string | null;
  encounterId?: string | null;
  visitId?: string | null;
};

export type IncomingPaymentResponse = {
  quoteId: string | null;
  totalZar: number | null;
  approved: boolean;
  invitedClinicians: InvitedClinicianInput[];
  roomId?: string | null;
  sessionId?: string | null;
  appointmentId?: string | null;
  encounterId?: string | null;
  visitId?: string | null;
};

type ToastApi = {
  info?: (message: string) => void;
  success?: (message: string) => void;
  error?: (message: string) => void;
};

type SendPaymentResponse = (payload: {
  approved: boolean;
  quoteId: string | null;
  totalZar: number | null;
  invitedClinicians: InvitedClinicianInput[];
  roomId?: string | null;
  sessionId?: string | null;
  appointmentId?: string | null;
  encounterId?: string | null;
  visitId?: string | null;
  ts: number;
}) => Promise<void>;

type Options = {
  toast: ToastApi;
  sendPaymentResponse: SendPaymentResponse;
  onIncomingPaymentResponse?: (response: IncomingPaymentResponse) => void;
};

function buildPaymentReadyMap(
  invitedClinicians: InvitedClinicianInput[],
  ready: boolean,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const c of invitedClinicians) {
    out[`clin-${c.clinicianId}`] = ready;
  }
  return out;
}

export function usePaymentApproval({
  toast,
  sendPaymentResponse,
  onIncomingPaymentResponse,
}: Options) {
  const [paymentApprovalOpen, setPaymentApprovalOpen] = useState(false);
  const [paymentApprovalBusy, setPaymentApprovalBusy] = useState(false);
  const [pendingPaymentRequest, setPendingPaymentRequest] =
    useState<PendingPaymentRequest | null>(null);
  const [paymentReadyByParty, setPaymentReadyByParty] = useState<
    Record<string, boolean>
  >({});

  const clearPendingPaymentRequest = useCallback(() => {
    setPendingPaymentRequest(null);
    setPaymentApprovalOpen(false);
  }, []);

  const dismissPaymentSheet = useCallback(() => {
    setPaymentApprovalOpen(false);
  }, []);

  const markInvitedCliniciansReady = useCallback(
    (invitedClinicians: InvitedClinicianInput[], ready: boolean) => {
      setPaymentReadyByParty((prev) => ({
        ...prev,
        ...buildPaymentReadyMap(invitedClinicians, ready),
      }));
    },
    [],
  );

  const handleIncomingChatPayload = useCallback(
    (parsed: unknown) => {
      const paymentRequest = parsePaymentRequestMessage(parsed);
      if (paymentRequest) {
        setPendingPaymentRequest({
          quoteId: paymentRequest.quoteId,
          totalZar: paymentRequest.totalZar,
          invitedClinicians: paymentRequest.invitedClinicians,
          roomId: paymentRequest.roomId,
          sessionId: paymentRequest.sessionId ?? null,
          appointmentId: paymentRequest.appointmentId ?? null,
          encounterId: paymentRequest.encounterId ?? null,
          visitId: paymentRequest.visitId ?? null,
        });
        setPaymentApprovalOpen(true);
        toast.info?.('Additional clinician approval requested.');
        return true;
      }

      const paymentResponse = parsePaymentResponseMessage(parsed);
      if (paymentResponse) {
        const shaped: IncomingPaymentResponse = {
          quoteId: paymentResponse.quoteId,
          totalZar: paymentResponse.totalZar,
          approved: paymentResponse.approved,
          invitedClinicians: paymentResponse.invitedClinicians,
          roomId: paymentResponse.roomId ?? null,
          sessionId: paymentResponse.sessionId ?? null,
          appointmentId: paymentResponse.appointmentId ?? null,
          encounterId: paymentResponse.encounterId ?? null,
          visitId: paymentResponse.visitId ?? null,
        };

        if (shaped.approved) {
          toast.success?.(
            shaped.quoteId
              ? `Payment approved for ${shaped.quoteId}.`
              : 'Additional clinician approved.',
          );
        } else {
          toast.info?.(
            shaped.quoteId
              ? `Payment declined for ${shaped.quoteId}.`
              : 'Additional clinician declined.',
          );
        }

        onIncomingPaymentResponse?.(shaped);
        return true;
      }

      return false;
    },
    [onIncomingPaymentResponse, toast],
  );

  const approve = useCallback(async () => {
    if (!pendingPaymentRequest) return;

    setPaymentApprovalBusy(true);
    try {
      if (pendingPaymentRequest.sessionId && pendingPaymentRequest.quoteId) {
        const res = await fetch(
          `/api/consultation-sessions/${encodeURIComponent(pendingPaymentRequest.sessionId)}/invite-quotes/${encodeURIComponent(pendingPaymentRequest.quoteId)}/approve`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          },
        );
        const js = await res.json().catch(() => ({} as any));
        if (!res.ok || js.ok === false) {
          throw new Error(js.error || 'failed_to_approve_invite_quote');
        }
      }

      await sendPaymentResponse({
        approved: true,
        quoteId: pendingPaymentRequest.quoteId,
        totalZar: pendingPaymentRequest.totalZar,
        invitedClinicians: pendingPaymentRequest.invitedClinicians,
        roomId: pendingPaymentRequest.roomId ?? null,
        sessionId: pendingPaymentRequest.sessionId ?? null,
        appointmentId: pendingPaymentRequest.appointmentId ?? null,
        encounterId: pendingPaymentRequest.encounterId ?? null,
        visitId: pendingPaymentRequest.visitId ?? null,
        ts: Date.now(),
      });

      markInvitedCliniciansReady(
        pendingPaymentRequest.invitedClinicians,
        true,
      );

      toast.success?.('Additional clinician approved.');
      clearPendingPaymentRequest();
    } catch (err) {
      console.error('[usePaymentApproval] approve error', err);
      toast.error?.('Failed to approve specialist request.');
    } finally {
      setPaymentApprovalBusy(false);
    }
  }, [
    clearPendingPaymentRequest,
    markInvitedCliniciansReady,
    pendingPaymentRequest,
    sendPaymentResponse,
    toast,
  ]);

  const decline = useCallback(async () => {
    if (!pendingPaymentRequest) return;

    setPaymentApprovalBusy(true);
    try {
      if (pendingPaymentRequest.sessionId && pendingPaymentRequest.quoteId) {
        const res = await fetch(
          `/api/consultation-sessions/${encodeURIComponent(pendingPaymentRequest.sessionId)}/invite-quotes/${encodeURIComponent(pendingPaymentRequest.quoteId)}/decline`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          },
        );
        const js = await res.json().catch(() => ({} as any));
        if (!res.ok || js.ok === false) {
          throw new Error(js.error || 'failed_to_decline_invite_quote');
        }
      }

      await sendPaymentResponse({
        approved: false,
        quoteId: pendingPaymentRequest.quoteId,
        totalZar: pendingPaymentRequest.totalZar,
        invitedClinicians: pendingPaymentRequest.invitedClinicians,
        roomId: pendingPaymentRequest.roomId ?? null,
        sessionId: pendingPaymentRequest.sessionId ?? null,
        appointmentId: pendingPaymentRequest.appointmentId ?? null,
        encounterId: pendingPaymentRequest.encounterId ?? null,
        visitId: pendingPaymentRequest.visitId ?? null,
        ts: Date.now(),
      });

      markInvitedCliniciansReady(
        pendingPaymentRequest.invitedClinicians,
        false,
      );

      toast.info?.('Additional clinician request declined.');
      clearPendingPaymentRequest();
    } catch (err) {
      console.error('[usePaymentApproval] decline error', err);
      toast.error?.('Failed to decline specialist request.');
    } finally {
      setPaymentApprovalBusy(false);
    }
  }, [
    clearPendingPaymentRequest,
    markInvitedCliniciansReady,
    pendingPaymentRequest,
    sendPaymentResponse,
    toast,
  ]);

  const hasPendingPaymentRequest = useMemo(
    () => Boolean(pendingPaymentRequest),
    [pendingPaymentRequest],
  );

  return {
    paymentApprovalOpen,
    setPaymentApprovalOpen,
    paymentApprovalBusy,
    pendingPaymentRequest,
    paymentReadyByParty,
    hasPendingPaymentRequest,
    approve,
    decline,
    dismissPaymentSheet,
    clearPendingPaymentRequest,
    handleIncomingChatPayload,
    markInvitedCliniciansReady,
  };
}

export default usePaymentApproval;