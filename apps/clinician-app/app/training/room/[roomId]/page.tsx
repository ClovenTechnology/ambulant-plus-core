'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { RoomEvent } from 'livekit-client';
import {
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mic,
  MicOff,
  MonitorPlay,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';

import SFUClientProvider, { useSFUClient } from '@/app/sfu/[roomId]/SFUClientProvider';
import VideoDock from '@/app/sfu/[roomId]/VideoDock';

type TrainingParticipantRole =
  | 'clinician'
  | 'patient'
  | 'trainer'
  | 'observer'
  | 'admin';

type TrainingChatMessage = {
  id: string;
  text: string;
  sentAt: string;
  participantIdentity: string;
  displayName: string;
  participantRole: TrainingParticipantRole | string;
};

type ObserverCapabilities = {
  microphone: boolean;
  camera: boolean;
  chat: boolean;
};

type TrainingMaterial = {
  id: string;
  trainingSlotId?: string | null;
  moduleId?: string | null;
  moduleTitle?: string | null;
  assignmentId?: string | null;
  assignmentScope?: 'programme' | 'sessions' | null;
  sessionIds?: string[];
  resourceId?: string | null;
  resourceVersionId?: string | null;
  title: string;
  kind?: string | null;
  url?: string | null;
  fileKey?: string | null;
  hasStoredFile?: boolean;
  fileName?: string | null;
  version?: string | null;
  notes?: string | null;
  required?: boolean;
  uploadedAt?: string | null;
};

type TrainingContentVersion = {
  id: string;
  version: string;
  status: string;
  url?: string | null;
  fileKey?: string | null;
  hasStoredFile?: boolean;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

type TrainingContentResource = {
  id: string;
  title: string;
  kind: string;
  description?: string | null;
  required: boolean;
  currentVersion?: TrainingContentVersion | null;
};

type TrainingContentModule = {
  id: string;
  title: string;
  summary?: string | null;
  assignmentId: string;
  assignmentScope: 'programme' | 'sessions';
  sessionIds: string[];
  resources: TrainingContentResource[];
};

type TrainingSessionRef = {
  id: string;
  dayNumber: number;
  startAt?: string | null;
  endAt?: string | null;
  mode?: string | null;
  trainerName?: string | null;
};

type TrainingMaterialResponse = {
  ok: boolean;
  role?: TrainingParticipantRole;
  identity?: {
    subjectId?: string | null;
    uid?: string | null;
    displayName?: string | null;
  } | null;
  trainingSlotId?: string | null;
  sessions?: TrainingSessionRef[];
  modules?: TrainingContentModule[];
  legacyMaterials?: TrainingMaterial[];
  items?: TrainingMaterial[];
  materials?: TrainingMaterial[];
};

type TrainingContext = {
  ok: boolean;
  clinician?: {
    id: string;
    name?: string | null;
    email?: string | null;
    specialty?: string | null;
    status?: string | null;
  };
  onboarding?: {
    stage?: string | null;
    notes?: string | null;
  } | null;
  training?: {
    status?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    mode?: string | null;
    joinUrl?: string | null;
    certificateAvailable?: boolean | null;
    certificateUrl?: string | null;
    roomState?: 'not_open' | 'open' | 'closed' | null;
    canJoin?: boolean | null;
    joinOpensAt?: string | null;
    joinClosesAt?: string | null;
  } | null;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function safeText(value: unknown, fallback = '—') {
  const v = String(value ?? '').trim();
  return v || fallback;
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function sessionContentLabel(
  session: TrainingSessionRef,
) {
  const when =
    session.startAt
      ? fmtDateTime(
          session.startAt,
        )
      : 'Time not set';

  return (
    `Day ${session.dayNumber} - ${when}` +
    (
      session.trainerName
        ? ` - ${session.trainerName}`
        : ''
    )
  );
}

function roomErrorMessage(
  value: unknown,
  training?: TrainingContext['training'],
) {
  const code = String(value || '').trim();

  if (code === 'training_room_not_open') {
    return training?.joinOpensAt
      ? `This room opens ${fmtDateTime(training.joinOpensAt)}. Your booking is valid; please return when the admission window opens.`
      : 'This training room is not open yet. Your booking remains valid.';
  }

  if (code === 'training_room_closed') {
    return 'This training room has closed. Return to your training schedule to choose another available date.';
  }

  if (code === 'training_booking_required') {
    return 'A current training booking is required before you can join this room.';
  }

  if (
    code === 'unauthorized' ||
    code === 'untrusted_clinician_identity' ||
    code === 'clinician_identity_required' ||
    code === 'clinician_not_found'
  ) {
    return 'Your signed-in clinician profile could not be verified. Sign in again from the clinician application, then return to your training schedule.';
  }

  return code || 'Unable to join the training room right now.';
}

function TrainingRoomInner({
  roomId,
  trainingSlotId,
  clinicianId,
  participantRole,
  participantUid,
  joinToken,
}: {
  roomId: string;
  trainingSlotId: string;
  clinicianId: string;
  participantRole: TrainingParticipantRole;
  participantUid: string;
  joinToken: string;
}) {
  const {
    room,
    status,
    error,
    connect,
    disconnect,
    remoteParticipants,
    setMicEnabled,
    setCamEnabled,
  } = useSFUClient();

  const [ctx, setCtx] = useState<TrainingContext | null>(null);
  const [resolvedClinicianId, setResolvedClinicianId] = useState(clinicianId);
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [contentModules, setContentModules] = useState<TrainingContentModule[]>([]);
  const [contentSessions, setContentSessions] = useState<TrainingSessionRef[]>([]);
  const [admissionVerified, setAdmissionVerified] = useState(participantRole === 'clinician');
  const [resolvedParticipantName, setResolvedParticipantName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [materialsNotice, setMaterialsNotice] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accessingResourceKey, setAccessingResourceKey] = useState<string | null>(null);
  const [recordingConsentAccepted, setRecordingConsentAccepted] = useState(false);
  const [showRecordingConsent, setShowRecordingConsent] = useState(false);

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<TrainingChatMessage[]>([]);
  const [observerCapabilities, setObserverCapabilities] = useState<ObserverCapabilities>({
    microphone: false,
    camera: false,
    chat: false,
  });
  const [presentation, setPresentation] = useState(false);

  const [showOverlay, setShowOverlay] = useState(true);
  const [showVitals, setShowVitals] = useState(false);
  const [showVitalsOverlay, setShowVitalsOverlay] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [xrEnabled, setXrEnabled] = useState(false);

  const roomStatusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'connecting'
        ? 'Connecting'
        : status === 'error'
          ? 'Connection issue'
          : 'Not connected';

  const isStaffJoin =
    participantRole === 'admin' ||
    participantRole === 'trainer' ||
    participantRole === 'observer';

  const isObserver =
    participantRole === 'observer';

  const participantLabel =
    participantRole === 'trainer'
      ? 'Training trainer'
      : participantRole === 'admin'
        ? 'Training administrator'
        : participantRole === 'observer'
          ? 'Training observer'
          : participantRole === 'patient'
            ? 'Training patient'
            : 'Training clinician';

  async function refreshTrainingMaterials() {
    try {
      const materialParams =
        new URLSearchParams();

      if (trainingSlotId) {
        materialParams.set(
          'trainingSlotId',
          trainingSlotId,
        );
      }

      const materialClinicianId =
        resolvedClinicianId ||
        clinicianId;

      if (materialClinicianId) {
        materialParams.set(
          'clinicianId',
          materialClinicianId,
        );
      }

      if (roomId) {
        materialParams.set(
          'roomId',
          roomId,
        );
      }

      const materialUrl =
        materialParams.toString()
          ? `/api/training/materials?${materialParams.toString()}`
          : '/api/training/materials';

      const materialHeaders =
        new Headers({
          accept:
            'application/json',
        });

      if (joinToken) {
        materialHeaders.set(
          'x-join-token',
          joinToken,
        );
      }

      const matRes =
        await fetch(
          materialUrl,
          {
            cache:
              'no-store',
            credentials:
              'include',
            headers:
              materialHeaders,
          },
        );

      const candidate =
        (await matRes
          .json()
          .catch(
            () => null,
          )) as
          | TrainingMaterialResponse
          | null;

      if (
        !matRes.ok ||
        !candidate?.ok
      ) {
        setMaterialsNotice(
          'Training materials are temporarily unavailable. You can still join and participate in the live session. Existing materials will remain visible while Ambulant+ retries automatically.',
        );

        return null;
      }

      const canonicalRole =
        String(
          candidate.role ||
          participantRole,
        ).toLowerCase();

      if (
        joinToken &&
        canonicalRole !==
          participantRole
      ) {
        setMaterialsNotice(
          'Training materials were not refreshed because the material audience does not match this signed room role. You can still join and participate in the live session.',
        );

        return null;
      }

      setContentModules(
        Array.isArray(
          candidate.modules,
        )
          ? candidate.modules
          : [],
      );

      setContentSessions(
        Array.isArray(
          candidate.sessions,
        )
          ? candidate.sessions
          : [],
      );

      setMaterials(
        Array.isArray(
          candidate.legacyMaterials,
        )
          ? candidate.legacyMaterials
          : (
              Array.isArray(
                candidate.items,
              )
                ? candidate.items.filter(
                    (item) =>
                      !item.moduleId,
                  )
                : []
            ),
      );

      const canonicalName =
        String(
          candidate.identity
            ?.displayName ||
          '',
        ).trim();

      if (canonicalName) {
        setResolvedParticipantName(
          canonicalName,
        );
      }

      setMaterialsNotice(
        null,
      );

      return candidate;
    } catch {
      setMaterialsNotice(
        'Training materials are temporarily unavailable. You can still join and participate in the live session. Existing materials will remain visible while Ambulant+ retries automatically.',
      );

      return null;
    }
  }

  async function loadRoomData() {
    setErr(null);

    try {
      if (
        participantRole !== 'clinician' &&
        !joinToken
      ) {
        throw new Error(
          'A signed training admission is required for this participant role.',
        );
      }

      setAdmissionVerified(
        participantRole ===
          'clinician' ||
        Boolean(
          joinToken,
        ),
      );

      const m =
        await refreshTrainingMaterials();

      const canonicalName =
        String(
          m?.identity
            ?.displayName ||
          participantLabel,
        ).trim();

      setResolvedParticipantName(
        canonicalName,
      );

      let nextCtx:
        | TrainingContext
        | null =
          null;

      if (
        participantRole ===
        'clinician'
      ) {
        const contextUrl =
          clinicianId
            ? `/api/training/context?clinicianId=${encodeURIComponent(clinicianId)}`
            : '/api/training/context';

        const ctxRes =
          await fetch(
            contextUrl,
            {
              cache:
                'no-store',
              credentials:
                'include',
            },
          );

        const c =
          (await ctxRes
            .json()
            .catch(
              () => null,
            )) as
            | TrainingContext
            | null;

        if (
          !ctxRes.ok ||
          !c?.ok
        ) {
          throw new Error(
            'Unable to load your training context right now.',
          );
        }

        nextCtx =
          c;

        const identityId =
          String(
            c.clinician?.id ||
            '',
          ).trim();

        if (!identityId) {
          throw new Error(
            'clinician_not_found',
          );
        }

        setResolvedClinicianId(
          identityId,
        );
      } else {
        nextCtx = {
          ok: true,
          clinician: {
            id:
              String(
                m?.identity
                  ?.subjectId ||
                participantUid ||
                participantRole,
              ),
            name:
              canonicalName,
            email: null,
            specialty:
              'Contactless Medicine training',
            status:
              `${participantRole}_join`,
          },
          onboarding: {
            stage:
              `${participantRole}_join`,
            notes: null,
          },
          training: {
            status:
              'training_scheduled',
            startAt: null,
            endAt: null,
            mode:
              'virtual',
            joinUrl: null,
            certificateAvailable:
              false,
            certificateUrl:
              null,
          },
        };

        setResolvedClinicianId(
          '',
        );
      }

      setCtx(
        nextCtx,
      );
    } catch (
      e: any
    ) {
      setAdmissionVerified(
        participantRole ===
          'clinician',
      );

      setErr(
        e?.message ||
        'Unable to load the training room right now.',
      );
    }
  }

  useEffect(() => {
    loadRoomData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clinicianId,
    trainingSlotId,
    participantRole,
    joinToken,
    roomId,
  ]);

  useEffect(() => {
    if (
      status !==
      'connected'
    ) {
      return;
    }

    const refresh =
      () => {
        void refreshTrainingMaterials();
      };

    const intervalId =
      window.setInterval(
        refresh,
        15_000,
      );

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          refresh();
        }
      };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };

    // The material query inputs are already represented below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    trainingSlotId,
    resolvedClinicianId,
    clinicianId,
    participantRole,
    joinToken,
    roomId,
  ]);

  useEffect(() => {
    const postAttendance = async (action: 'join' | 'heartbeat' | 'leave') => {
      try {
        await fetch('/api/training/attendance', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            trainingSlotId,
            roomId,
            clinicianId: resolvedClinicianId,
            action,
            at: new Date().toISOString(),
          }),
        });
      } catch {
        // attendance is best-effort; do not interrupt the room
      }
    };

    if (status === 'connected' && resolvedClinicianId) {
      postAttendance('join');
      const id = window.setInterval(() => postAttendance('heartbeat'), 60_000);

      return () => {
        window.clearInterval(id);
        postAttendance('leave');
      };
    }
  }, [status, roomId, trainingSlotId, resolvedClinicianId]);

  async function openTrainingResourceFile(
    resource: TrainingContentResource,
    disposition:
      | 'inline'
      | 'attachment',
  ) {
    const version =
      resource.currentVersion;

    if (
      !version?.id ||
      !version
        .hasStoredFile
    ) {
      setErr(
        'This training resource does not have a stored file available.',
      );
      return;
    }

    const accessKey =
      `${resource.id}:${version.id}:${disposition}`;

    setAccessingResourceKey(
      accessKey,
    );
    setErr(null);

    const popup =
      window.open(
        '',
        '_blank',
      );

    try {
      const response =
        await fetch(
          '/api/training/materials',
          {
            method:
              'POST',
            cache:
              'no-store',
            credentials:
              'include',
            headers: {
              accept:
                'application/json',
              'content-type':
                'application/json',
              ...(
                joinToken
                  ? {
                      'x-join-token':
                        joinToken,
                    }
                  : {}
              ),
            },
            body:
              JSON.stringify({
                action:
                  'access_file',
                trainingSlotId,
                roomId,
                clinicianId:
                  resolvedClinicianId ||
                  clinicianId ||
                  null,
                resourceId:
                  resource.id,
                versionId:
                  version.id,
                disposition,
              }),
          },
        );

      const body =
        await response
          .json()
          .catch(
            () => null,
          );

      if (
        !response.ok ||
        !body?.ok ||
        !body
          ?.accessUrl
      ) {
        throw new Error(
          body?.message ||
          body?.error ||
          'Unable to create a secure training-file link.',
        );
      }

      if (popup) {
        popup.opener =
          null;
        popup.location.href =
          String(
            body.accessUrl,
          );
      } else {
        window.location.href =
          String(
            body.accessUrl,
          );
      }
    } catch (
      reason: any
    ) {
      if (
        popup &&
        !popup.closed
      ) {
        popup.close();
      }

      setErr(
        String(
          reason?.message ||
          'Unable to open the secure training file.',
        ),
      );
    } finally {
      setAccessingResourceKey(
        null,
      );
    }
  }

  function appendChatMessage(message: TrainingChatMessage) {
    setChatMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current;
      return [...current, message].slice(-200);
    });
  }

  async function postCollaboration(payload: Record<string, unknown>) {
    if (!joinToken) {
      throw new Error('A signed training admission is required for this collaboration action.');
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
      body: JSON.stringify({
        roomId,
        ...payload,
      }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      throw new Error(String(body?.message || body?.error || 'training_collaboration_failed'));
    }
    return body;
  }

  useEffect(() => {
    if (!room) return;

    const onData = (
      payload: Uint8Array,
      participant: any,
      _kind: any,
      topic?: string,
    ) => {
      let parsed: any = null;
      try {
        parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }

      if (topic === 'chat') {
        const text = String(parsed?.text || '').trim();
        if (!text) return;

        let remoteMetadata: any = {};
        try {
          remoteMetadata = participant?.metadata
            ? JSON.parse(participant.metadata)
            : {};
        } catch {
          remoteMetadata = {};
        }

        const senderIdentity = String(
          participant?.identity ||
          parsed?.participantIdentity ||
          'participant',
        );

        appendChatMessage({
          id: String(parsed?.id || `${senderIdentity}:${parsed?.sentAt || Date.now()}:${text}`),
          text,
          sentAt: String(parsed?.sentAt || new Date().toISOString()),
          participantIdentity: senderIdentity,
          displayName: String(
            participant?.name ||
            remoteMetadata?.displayName ||
            parsed?.displayName ||
            senderIdentity,
          ),
          participantRole: String(
            remoteMetadata?.participantRole ||
            parsed?.participantRole ||
            'participant',
          ),
        });
        return;
      }

      if (topic !== 'control') return;

      const type = String(parsed?.type || '');
      const targetIdentity = String(parsed?.targetIdentity || parsed?.participantIdentity || '');

      if ((type === 'raise_hand' || type === 'hand') && targetIdentity === participantUid) {
        setHandRaised(Boolean(parsed?.value));
      }

      if (type === 'training_capability' && targetIdentity === participantUid && isObserver) {
        const capability = String(parsed?.capability || '');
        const enabled = Boolean(parsed?.enabled);
        setObserverCapabilities((current) => ({
          ...current,
          ...(capability === 'microphone' ? { microphone: enabled } : {}),
          ...(capability === 'camera' ? { camera: enabled } : {}),
          ...(capability === 'chat' ? { chat: enabled } : {}),
        }));

        if (capability === 'microphone' && !enabled) setMicOn(false);
        if (capability === 'camera' && !enabled) setCamOn(false);

        setNotice(
          enabled
            ? `Trainer enabled your ${capability} capability for this session.`
            : `Trainer disabled your ${capability} capability for this session.`,
        );
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, participantUid, isObserver]);

  useEffect(() => {
    if (!room || !isObserver || status !== 'connected') return;

    const syncCapabilities = () => {
      const attributes = ((room.localParticipant as any).attributes || {}) as Record<string, string>;
      setObserverCapabilities({
        microphone: attributes.trainingMediaMicrophone === '1',
        camera: attributes.trainingMediaCamera === '1',
        chat: attributes.trainingChatWrite === '1',
      });
    };

    const onAttributesChanged = (
      _changed: Record<string, string>,
      participant: any,
    ) => {
      if (participant?.identity === room.localParticipant.identity) {
        syncCapabilities();
      }
    };

    syncCapabilities();
    room.on(RoomEvent.ParticipantAttributesChanged, onAttributesChanged);

    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, onAttributesChanged);
    };
  }, [room, status, isObserver]);

  useEffect(() => {
    if (!room) {
      setScreenSharing(false);
      return;
    }

    const sync = () => {
      const active = Array.from(room.localParticipant.videoTrackPublications.values()).some(
        (publication: any) => publication.source === 'screen_share' && Boolean(publication.track),
      );
      setScreenSharing(active);
    };

    sync();
    room.on(RoomEvent.LocalTrackPublished, sync);
    room.on(RoomEvent.LocalTrackUnpublished, sync);
    return () => {
      room.off(RoomEvent.LocalTrackPublished, sync);
      room.off(RoomEvent.LocalTrackUnpublished, sync);
    };
  }, [room]);

  async function sendChatMessage() {
    const text = chatInput.trim().slice(0, 1200);
    if (!text || !room || status !== 'connected') return;

    if (isObserver && !observerCapabilities.chat) {
      setNotice('Observer chat is read-only until an admin or trainer enables chat contribution.');
      return;
    }

    setErr(null);
    try {
      if (joinToken) {
        const result = await postCollaboration({ action: 'chat.send', text });
        if (result?.message) {
          appendChatMessage(result.message as TrainingChatMessage);
        }
      } else {
        const message: TrainingChatMessage = {
          id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text,
          sentAt: new Date().toISOString(),
          participantIdentity: participantUid,
          displayName: participantName,
          participantRole,
        };
        await room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(message)),
          { reliable: true, topic: 'chat' },
        );
        appendChatMessage(message);
      }
      setChatInput('');
    } catch (reason: any) {
      setErr(String(reason?.message || 'Unable to send room message.').split('_').join(' '));
    }
  }

  async function toggleHandRaise() {
    if (!room || status !== 'connected') return;
    const next = !handRaised;
    setErr(null);
    try {
      if (joinToken) {
        await postCollaboration({ action: 'hand.set', raised: next });
      } else {
        await room.localParticipant.publishData(
          new TextEncoder().encode(
            JSON.stringify({
              type: 'raise_hand',
              value: next,
              participantIdentity: participantUid,
              displayName: participantName,
              participantRole,
              ts: Date.now(),
            }),
          ),
          { reliable: true, topic: 'control' },
        );
      }
      setHandRaised(next);
    } catch (reason: any) {
      setErr(String(reason?.message || 'Unable to update hand raise.').split('_').join(' '));
    }
  }

  async function toggleScreenShare() {
    if (!room || status !== 'connected') return;
    if (isObserver) {
      setNotice('Observers cannot share their screen.');
      return;
    }

    const next = !screenSharing;
    setErr(null);
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenSharing(next);
    } catch {
      setErr('Unable to change screen sharing state.');
    }
  }

  async function joinLiveRoom() {
    setErr(null);
    setNotice(null);

    try {
      await connect();
      setNotice('Connected to the training room.');
    } catch (joinError: any) {
      setErr(roomErrorMessage(joinError?.message, ctx?.training));
    }
  }

  function handleConnect() {
    if (!recordingConsentAccepted) {
      setShowRecordingConsent(true);
      return;
    }

    void joinLiveRoom();
  }

  async function acceptRecordingConsentAndJoin() {
    setRecordingConsentAccepted(true);
    setShowRecordingConsent(false);
    await joinLiveRoom();
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      setMicOn(false);
      setCamOn(false);
      setScreenSharing(false);
      setHandRaised(false);
      setNotice('You left the training room.');
    } catch {
      setErr('Unable to leave cleanly. Please refresh the page if the room remains connected.');
    }
  }

  async function toggleMic() {
    if (isObserver && !observerCapabilities.microphone) {
      setNotice(
        'Observer microphone is disabled until an admin or trainer grants speaking permission.',
      );
      return;
    }

    const next = !micOn;
    setMicOn(next);
    try {
      await setMicEnabled(next);
    } catch {
      setMicOn(!next);
      setErr('Unable to change microphone state.');
    }
  }

  async function toggleCam() {
    if (isObserver && !observerCapabilities.camera) {
      setNotice(
        'Observer camera is disabled until an admin or trainer grants camera permission.',
      );
      return;
    }

    const next = !camOn;
    setCamOn(next);
    try {
      await setCamEnabled(next);
    } catch {
      setCamOn(!next);
      setErr('Unable to change camera state.');
    }
  }

  const emptyVitals = useMemo(
    () => ({
      hr: undefined,
      spo2: undefined,
      tempC: undefined,
      rr: undefined,
      sys: undefined,
      dia: undefined,
    }),
    [],
  );

  const participantName =
    resolvedParticipantName ||
    ctx?.clinician?.name ||
    participantLabel;

  const joinPermitted =
    participantRole ===
      'clinician'
      ? ctx?.training
          ?.canJoin === true
      : admissionVerified &&
        Boolean(joinToken);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.10),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.08),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_44%,_#ffffff_100%)] font-sans text-slate-900">
      <div className="mx-auto max-w-[1480px] space-y-5 p-4 md:p-6 xl:p-8">
        <header className="rounded-[30px] border border-white/80 bg-white/92 p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur-xl md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-900 shadow-sm">
                <MonitorPlay className="h-4 w-4" />
                Ambulant+ mandatory training room
              </div>

              <h1 className="mt-4 text-[clamp(1.8rem,2.7vw,2.55rem)] font-semibold tracking-[-0.035em] text-slate-950">
                Contactless Medicine training session
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 md:text-[15px]">
                Join the trainer-led virtual room, review materials, keep attendance active, and complete the certification pathway before workspace access is unlocked.
              </p>

              {ctx?.training?.startAt ? (
                <div className="mt-2 text-xs text-slate-500">
                  Scheduled: {fmtDateTime(ctx.training.startAt)} → {fmtDateTime(ctx.training.endAt)}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cx(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-sm',
                  status === 'connected'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : status === 'connecting'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : status === 'error'
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-700',
                )}
              >
                <span
                  className={cx(
                    'h-2 w-2 rounded-full',
                    status === 'connected'
                      ? 'bg-emerald-500'
                      : status === 'connecting'
                        ? 'bg-amber-500'
                        : status === 'error'
                          ? 'bg-rose-500'
                          : 'bg-slate-400',
                  )}
                />
                {roomStatusLabel}
              </span>

              {status !== 'connected' ? (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={status === 'connecting' || !joinPermitted}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === 'connecting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                  Join room
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Leave room
                </button>
              )}

              <Link
                href="/training/schedule"
                className="inline-flex min-h-10 items-center rounded-full border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Back to training
              </Link>
            </div>
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              {notice}
            </div>
          ) : null}

          {!isStaffJoin && ctx?.training?.roomState === 'not_open' ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {roomErrorMessage('training_room_not_open', ctx.training)}
            </div>
          ) : null}

          {!isStaffJoin && ctx?.training?.roomState === 'closed' ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              {roomErrorMessage('training_room_closed', ctx.training)}
            </div>
          ) : null}

          {err || error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {err || error || 'Training room connection issue.'}
            </div>
          ) : null}
        </header>

        {showRecordingConsent ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-900">
                Recording notice
              </div>

              <h2 className="mt-4 text-xl font-black text-slate-950">
                Training session recording notice
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                This training session may be recorded for onboarding, attendance, quality assurance, audit, and certification purposes. By joining, you confirm that you understand the session may be recorded. The recording will be stored securely and accessed only by authorised Ambulant+ administrators.
              </p>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Link
                  href="/training/schedule"
                  className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Back to training
                </Link>

                <button
                  type="button"
                  onClick={acceptRecordingConsentAndJoin}
                  className="inline-flex justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700"
                >
                  I understand and join
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="space-y-5">
          <div className="rounded-[30px] border border-white/80 bg-white/94 p-3 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur-xl md:p-4">
            <div className="mb-3 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.01em] text-slate-950">
                  Live training room
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1">
                    Room
                    <span className="font-mono text-[11px] text-slate-700">{roomId || '—'}</span>
                  </span>
                  {status === 'connected' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={
                    status !== 'connected' ||
                    (isObserver && !observerCapabilities.microphone)
                  }
                  className={cx(
                    'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40',
                    micOn
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  {micOn ? 'Mic on' : 'Mic off'}
                </button>

                <button
                  type="button"
                  onClick={toggleCam}
                  disabled={
                    status !== 'connected' ||
                    (isObserver && !observerCapabilities.camera)
                  }
                  className={cx(
                    'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40',
                    camOn
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  {camOn ? 'Camera on' : 'Camera off'}
                </button>

                <button
                  type="button"
                  onClick={toggleScreenShare}
                  disabled={status !== 'connected' || isObserver}
                  className={cx(
                    'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40',
                    screenSharing
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  {screenSharing ? 'Stop sharing' : 'Share screen'}
                </button>

                <button
                  type="button"
                  onClick={toggleHandRaise}
                  disabled={status !== 'connected'}
                  className={cx(
                    'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40',
                    handRaised
                      ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  {handRaised ? '✋ Lower hand' : '✋ Raise hand'}
                </button>

                <button
                  type="button"
                  onClick={() => setPresentation((v) => !v)}
                  className={cx(
                    'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-sm transition',
                    presentation
                      ? 'border-slate-900 bg-slate-950 text-white hover:bg-slate-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  {presentation ? 'Exit focus' : 'Focus mode'}
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-slate-900/10 bg-slate-950 shadow-inner">
              <VideoDock
                room={room}
                vitals={emptyVitals}
                dense={false}
                presentation={presentation}
                patientName={participantName}
                micOn={micOn}
                camOn={camOn}
                showOverlay={showOverlay}
                showVitals={showVitals}
                showVitalsOverlay={showVitalsOverlay}
                captionsOn={captionsOn}
                isRecording={isRecording}
                xrEnabled={xrEnabled}
                pip={{ x: 0, y: 0 }}
                onToggleMic={toggleMic}
                onToggleCam={toggleCam}
                onToggleOverlay={setShowOverlay}
                onToggleVitals={setShowVitals}
                onToggleVitalsOverlay={setShowVitalsOverlay}
                onToggleCaptions={setCaptionsOn}
                onToggleRecording={
                  isObserver
                    ? () =>
                        setNotice(
                          'Observers cannot control training recording.',
                        )
                    : setIsRecording
                }
                onToggleXr={setXrEnabled}
                onEnterPresentation={() => setPresentation(true)}
                onExitPresentation={() => setPresentation(false)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatusCard
              title="Attendance"
              value={status === 'connected' ? 'Active heartbeat' : 'Not recording'}
              detail="Attendance is recorded while connected, with a heartbeat every 60 seconds."
              done={status === 'connected'}
            />

            <StatusCard
              title="Participants"
              value={`${remoteParticipants.length} remote`}
              detail="Trainer, admins, and other training participants appear here as they join."
              done={remoteParticipants.length > 0}
            />

            <StatusCard
              title="Certification gate"
              value={safeText(ctx?.onboarding?.stage || ctx?.training?.status)}
              detail="Admin certification is required before full workspace visibility."
              done={ctx?.onboarding?.stage === 'training_completed' || ctx?.training?.status === 'completed'}
            />
          </div>

          <div className="grid items-stretch gap-5 xl:grid-cols-[0.88fr_1.12fr]">
            <Panel title="Session & identity" icon={<Users className="h-4 w-4" />}>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <InfoRow
                  label={participantRole === 'clinician' ? 'Clinician' : 'Participant'}
                  value={participantName}
                />
                <InfoRow label="Role" value={participantRole} />
                {participantRole === 'clinician' ? (
                  <>
                    <InfoRow label="Email" value={ctx?.clinician?.email} />
                    <InfoRow label="Specialty" value={ctx?.clinician?.specialty} />
                  </>
                ) : null}
                <InfoRow label="Stage" value={ctx?.onboarding?.stage} />
                <InfoRow label="Mode" value={ctx?.training?.mode} />
                <InfoRow label="Slot" value={trainingSlotId || ctx?.training?.startAt || '—'} mono />
                <InfoRow
                  label="Media"
                  value={
                    isObserver
                      ? `Mic ${observerCapabilities.microphone ? 'allowed' : 'blocked'} · Camera ${observerCapabilities.camera ? 'allowed' : 'blocked'} · Chat ${observerCapabilities.chat ? 'write enabled' : 'read-only'}`
                      : 'Role-authorised'
                  }
                />
              </div>

              <div className="mt-5 rounded-2xl border border-indigo-100/80 bg-indigo-50/65 p-3.5 text-xs leading-5 text-indigo-950">
                Your signed training admission preserves this participant role through the room and RTC token. Materials and collaboration permissions remain role-authorised.
              </div>
            </Panel>

            <Panel title="Room chat">
              <div className="flex h-full min-h-[280px] flex-col">
                <div className="max-h-80 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                  {chatMessages.length === 0 ? (
                    <div className="grid min-h-36 place-items-center text-center">
                      <div>
                        <div className="text-sm font-medium text-slate-700">No room messages yet</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Messages shared here stay inside the live training room.
                        </div>
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className="rounded-2xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 truncate text-xs font-semibold text-slate-900">
                            {message.displayName}
                            <span className="ml-2 font-medium capitalize text-slate-400">
                              {String(message.participantRole).split('_').join(' ')}
                            </span>
                          </div>
                          <div className="shrink-0 text-[10px] font-medium text-slate-400">
                            {new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">
                          {message.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {isObserver && !observerCapabilities.chat ? (
                  <div className="mt-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3 text-xs leading-5 text-amber-900">
                    Observer chat is read-only. Raise your hand and an admin or trainer can enable chat contribution for this session.
                  </div>
                ) : (
                  <div className="mt-3 flex items-end gap-2">
                    <textarea
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void sendChatMessage();
                        }
                      }}
                      disabled={status !== 'connected'}
                      maxLength={1200}
                      rows={1}
                      placeholder="Message the training room"
                      className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-5 text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70 disabled:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => void sendChatMessage()}
                      disabled={status !== 'connected' || !chatInput.trim()}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      Send
                    </button>
                  </div>
                )}

                <div className="mt-2 text-[10px] text-slate-400">
                  Enter to send · Shift + Enter for a new line
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Training materials" icon={<FileText className="h-4 w-4" />}>
            <div className="space-y-3">
              {materialsNotice ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {materialsNotice}
                </div>
              ) : null}

              {contentModules.length === 0 && materials.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm leading-6 text-slate-600">
                  No published materials are currently available for your training role. You can still join and participate in the live session. Newly published materials will appear automatically while you remain connected.
                </div>
              ) : (
                <div className="space-y-4">
                {contentModules.map((module) => {
                  const assignedSessions =
                    module.sessionIds
                      .map(
                        (sessionId) =>
                          contentSessions.find(
                            (session) =>
                              session.id ===
                              sessionId,
                          ),
                      )
                      .filter(
                        (
                          session,
                        ): session is TrainingSessionRef =>
                          Boolean(session),
                      );

                  return (
                    <div
                      key={module.assignmentId}
                      className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-950">
                            {module.title}
                          </div>
                          {module.summary ? (
                            <div className="mt-1 text-xs text-slate-600">
                              {module.summary}
                            </div>
                          ) : null}
                        </div>

                        <span className="rounded-full border border-indigo-100 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                          {module.assignmentScope === 'programme'
                            ? 'Programme-wide'
                            : `${module.sessionIds.length} session(s)`}
                        </span>
                      </div>

                      {module.assignmentScope === 'sessions' ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {assignedSessions.map((session) => (
                            <span
                              key={session.id}
                              title={`Session ID: ${session.id}`}
                              className="rounded-full border bg-white px-2 py-1 text-[10px] font-medium text-slate-600"
                            >
                              {sessionContentLabel(session)}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-3 space-y-2">
                        {module.resources.map((resource) => {
                          const version =
                            resource.currentVersion;

                          return (
                            <div
                              key={resource.id}
                              className="rounded-xl border border-slate-200 bg-white p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">
                                    {resource.title}
                                  </div>
                                  {resource.description ? (
                                    <div className="mt-1 text-xs text-slate-600">
                                      {resource.description}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap gap-1">
                                  <span className="rounded-full border bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {resource.kind}
                                  </span>
                                  <span className="rounded-full border bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {resource.required ? 'Required' : 'Optional'}
                                  </span>
                                  {version?.version ? (
                                    <span className="rounded-full border bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">
                                      {version.version}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {version?.url ? (
                                  <a
                                    href={version.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    View resource
                                  </a>
                                ) : null}

                                {version?.hasStoredFile ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={
                                        accessingResourceKey ===
                                        `${resource.id}:${version.id}:inline`
                                      }
                                      onClick={() =>
                                        void openTrainingResourceFile(
                                          resource,
                                          'inline',
                                        )
                                      }
                                      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      {accessingResourceKey ===
                                      `${resource.id}:${version.id}:inline`
                                        ? 'Opening...'
                                        : 'View file'}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        accessingResourceKey ===
                                        `${resource.id}:${version.id}:attachment`
                                      }
                                      onClick={() =>
                                        void openTrainingResourceFile(
                                          resource,
                                          'attachment',
                                        )
                                      }
                                      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      {accessingResourceKey ===
                                      `${resource.id}:${version.id}:attachment`
                                        ? 'Preparing...'
                                        : 'Download'}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {materials.length > 0 ? (
                  <div className="space-y-2 border-t border-slate-200 pt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Existing programme-only materials
                    </div>

                    {materials.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {m.title}
                        </div>

                        {m.notes ? (
                          <div className="mt-1 text-xs text-slate-600">
                            {m.notes}
                          </div>
                        ) : null}

                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.url ? (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </a>
                          ) : null}

                          {m.fileKey ? (
                            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                              <Download className="h-3.5 w-3.5" />
                              Stored file
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            </div>
          </Panel>

          {participantRole === 'clinician' ? (
            <Panel title="Completion pathway" icon={<CheckCircle2 className="h-4 w-4" />}>
              <ol className="grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-2">
                <li className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">1. Join and remain present during trainer-led orientation.</li>
                <li className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">2. Complete platform, device, documentation, and safety workflow training.</li>
                <li className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">3. Admin confirms attendance and certifies completion.</li>
                <li className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">4. Your clinician profile can then be activated for patient visibility.</li>
              </ol>

              {ctx?.training?.certificateAvailable && ctx?.training?.certificateUrl ? (
                <a
                  href={`${ctx.training.certificateUrl}?download=1`}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                >
                  <Download className="h-4 w-4" />
                  Download certificate
                </a>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  Certificate becomes available after admin certification.
                </div>
              )}
            </Panel>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-slate-50/65 px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <div
        className={cx(
          'mt-1 break-words text-sm font-medium leading-5 text-slate-900',
          mono && 'font-mono text-[11px] text-slate-700',
        )}
      >
        {safeText(value)}
      </div>
    </div>
  );
}

function StatusCard({
  title,
  value,
  detail,
  done,
}: {
  title: string;
  value: string;
  detail: string;
  done?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/94 p-4 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</div>
        <span
          className={cx(
            'h-2 w-2 rounded-full shadow-sm',
            done ? 'bg-emerald-500' : 'bg-slate-300',
          )}
        />
      </div>
      <div className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-950">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="h-full rounded-[26px] border border-white/80 bg-white/94 p-5 shadow-[0_22px_58px_-38px_rgba(15,23,42,0.45)] backdrop-blur md:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        {icon ? (
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
            {icon}
          </span>
        ) : null}
        <div className="text-[15px] font-semibold tracking-[-0.015em] text-slate-950">
          {title}
        </div>
      </div>
      {children}
    </section>
  );
}

function TrainingRoomPageContent() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams() ?? new URLSearchParams();

  const roomId = String(params?.roomId || '');
  const trainingSlotId = search.get('trainingSlotId') || '';
  const clinicianIdFromQuery = search.get('clinicianId') || '';
  const uidFromQuery = search.get('uid') || search.get('identity') || '';
  const joinToken = search.get('joinToken') || '';
  const roleFromQuery = String(search.get('role') || '').toLowerCase();

  const participantRole: TrainingParticipantRole =
    roleFromQuery === 'admin' ||
    roleFromQuery === 'trainer' ||
    roleFromQuery === 'observer' ||
    roleFromQuery === 'patient'
      ? roleFromQuery
      : 'clinician';

  const clinicianId = clinicianIdFromQuery;

  const uid = uidFromQuery || (
    clinicianId
      ? `training-clinician-${clinicianId}`
      : `training-${participantRole}-${roomId || 'unknown'}`
  );

  const providerRole =
    participantRole === 'trainer'
      ? 'admin'
      : participantRole;

  return (
    <SFUClientProvider
      roomId={roomId}
      role={providerRole}
      uid={uid}
      tokenEndpoint={typeof window !== 'undefined' ? `${window.location.origin}/api/rtc/token` : '/api/rtc/token'}
      autoConnect={false}
    >
      <TrainingRoomInner
        roomId={roomId}
        trainingSlotId={trainingSlotId}
        clinicianId={clinicianId}
        participantRole={participantRole}
        participantUid={uid}
        joinToken={joinToken}
      />
    </SFUClientProvider>
  );
}

export default function TrainingRoomPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-7xl p-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm font-medium text-slate-600 shadow-sm">
              Loading training room…
            </div>
          </div>
        </main>
      }
    >
      <TrainingRoomPageContent />
    </Suspense>
  );
}
