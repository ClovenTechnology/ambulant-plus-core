-- Sprint C1A: shared meeting / external guest admission foundation.
-- Additive migration only. No existing table/column is dropped or renamed.

ALTER TYPE "AuditActorType" ADD VALUE IF NOT EXISTS 'EXTERNAL_GUEST';

CREATE TYPE "MeetingKind" AS ENUM ('STANDARD', 'DIRECT_CALL', 'INTERVIEW');
CREATE TYPE "MeetingState" AS ENUM ('DRAFT', 'SCHEDULED', 'RINGING', 'LIVE', 'ENDED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "MeetingParticipantType" AS ENUM ('INTERNAL_STAFF', 'EXTERNAL_GUEST');
CREATE TYPE "MeetingParticipantRole" AS ENUM ('HOST', 'COHOST', 'PRESENTER', 'ATTENDEE', 'INTERVIEWEE');
CREATE TYPE "MeetingParticipantState" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'JOINED', 'LEFT', 'REMOVED');
CREATE TYPE "MeetingInvitationState" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED', 'EXPIRED');
CREATE TYPE "MeetingLobbyState" AS ENUM ('WAITING', 'ADMITTED', 'REJECTED', 'LEFT');

CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "roomId" VARCHAR(180) NOT NULL,
    "kind" "MeetingKind" NOT NULL DEFAULT 'STANDARD',
    "state" "MeetingState" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(240) NOT NULL,
    "agenda" TEXT,
    "timezone" VARCHAR(120) NOT NULL DEFAULT 'Africa/Johannesburg',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "createdByProfileId" TEXT NOT NULL,
    "hostProfileId" TEXT NOT NULL,
    "contextType" VARCHAR(80),
    "contextId" VARCHAR(240),
    "allowAudio" BOOLEAN NOT NULL DEFAULT true,
    "allowVideo" BOOLEAN NOT NULL DEFAULT true,
    "allowChat" BOOLEAN NOT NULL DEFAULT true,
    "allowFiles" BOOLEAN NOT NULL DEFAULT true,
    "allowScreenShare" BOOLEAN NOT NULL DEFAULT true,
    "allowRecording" BOOLEAN NOT NULL DEFAULT false,
    "lobbyRequired" BOOLEAN NOT NULL DEFAULT true,
    "lockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledByProfileId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "participantType" "MeetingParticipantType" NOT NULL,
    "staffProfileId" TEXT,
    "emailNormalized" VARCHAR(320),
    "displayName" VARCHAR(240) NOT NULL,
    "role" "MeetingParticipantRole" NOT NULL DEFAULT 'ATTENDEE',
    "state" "MeetingParticipantState" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "firstJoinedAt" TIMESTAMP(3),
    "lastLeftAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingInvitation" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "emailNormalized" VARCHAR(320) NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "pinHash" VARCHAR(320),
    "state" "MeetingInvitationState" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdByProfileId" TEXT NOT NULL,
    "subjectOverride" VARCHAR(240),
    "messageOverride" TEXT,
    "templateKey" VARCHAR(120),
    "templateVersion" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingGuestSession" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "sessionTokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipHash" VARCHAR(128),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingGuestSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingLobbyEntry" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "guestSessionId" TEXT,
    "state" "MeetingLobbyState" NOT NULL DEFAULT 'WAITING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByProfileId" TEXT,
    "decisionReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingLobbyEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingAttendanceSession" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "clientSessionId" VARCHAR(128) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "disconnectReason" VARCHAR(240),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAttendanceSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Meeting_roomId_key" ON "Meeting"("roomId");
CREATE INDEX "Meeting_state_startsAt_idx" ON "Meeting"("state", "startsAt");
CREATE INDEX "Meeting_createdByProfileId_createdAt_idx" ON "Meeting"("createdByProfileId", "createdAt");
CREATE INDEX "Meeting_hostProfileId_startsAt_idx" ON "Meeting"("hostProfileId", "startsAt");
CREATE INDEX "Meeting_contextType_contextId_idx" ON "Meeting"("contextType", "contextId");

CREATE UNIQUE INDEX "meeting_participant_staff_key" ON "MeetingParticipant"("meetingId", "staffProfileId");
CREATE UNIQUE INDEX "meeting_participant_email_key" ON "MeetingParticipant"("meetingId", "emailNormalized");
CREATE INDEX "MeetingParticipant_meetingId_role_state_idx" ON "MeetingParticipant"("meetingId", "role", "state");
CREATE INDEX "MeetingParticipant_emailNormalized_meetingId_idx" ON "MeetingParticipant"("emailNormalized", "meetingId");
CREATE INDEX "MeetingParticipant_staffProfileId_state_idx" ON "MeetingParticipant"("staffProfileId", "state");

CREATE UNIQUE INDEX "MeetingInvitation_tokenHash_key" ON "MeetingInvitation"("tokenHash");
CREATE INDEX "MeetingInvitation_meetingId_state_expiresAt_idx" ON "MeetingInvitation"("meetingId", "state", "expiresAt");
CREATE INDEX "MeetingInvitation_emailNormalized_createdAt_idx" ON "MeetingInvitation"("emailNormalized", "createdAt");
CREATE INDEX "MeetingInvitation_participantId_createdAt_idx" ON "MeetingInvitation"("participantId", "createdAt");

CREATE UNIQUE INDEX "MeetingGuestSession_sessionTokenHash_key" ON "MeetingGuestSession"("sessionTokenHash");
CREATE INDEX "MeetingGuestSession_invitationId_expiresAt_idx" ON "MeetingGuestSession"("invitationId", "expiresAt");
CREATE INDEX "MeetingGuestSession_expiresAt_revokedAt_idx" ON "MeetingGuestSession"("expiresAt", "revokedAt");

CREATE UNIQUE INDEX "meeting_lobby_participant_key" ON "MeetingLobbyEntry"("meetingId", "participantId");
CREATE INDEX "MeetingLobbyEntry_meetingId_state_requestedAt_idx" ON "MeetingLobbyEntry"("meetingId", "state", "requestedAt");
CREATE INDEX "MeetingLobbyEntry_guestSessionId_idx" ON "MeetingLobbyEntry"("guestSessionId");

CREATE UNIQUE INDEX "MeetingAttendanceSession_clientSessionId_key" ON "MeetingAttendanceSession"("clientSessionId");
CREATE INDEX "MeetingAttendanceSession_meetingId_joinedAt_idx" ON "MeetingAttendanceSession"("meetingId", "joinedAt");
CREATE INDEX "MeetingAttendanceSession_participantId_joinedAt_idx" ON "MeetingAttendanceSession"("participantId", "joinedAt");

ALTER TABLE "Meeting"
  ADD CONSTRAINT "Meeting_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Meeting"
  ADD CONSTRAINT "Meeting_hostProfileId_fkey"
  FOREIGN KEY ("hostProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Meeting"
  ADD CONSTRAINT "Meeting_cancelledByProfileId_fkey"
  FOREIGN KEY ("cancelledByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingParticipant"
  ADD CONSTRAINT "MeetingParticipant_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingParticipant"
  ADD CONSTRAINT "MeetingParticipant_staffProfileId_fkey"
  FOREIGN KEY ("staffProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingInvitation"
  ADD CONSTRAINT "MeetingInvitation_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingInvitation"
  ADD CONSTRAINT "MeetingInvitation_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "MeetingParticipant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingInvitation"
  ADD CONSTRAINT "MeetingInvitation_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MeetingGuestSession"
  ADD CONSTRAINT "MeetingGuestSession_invitationId_fkey"
  FOREIGN KEY ("invitationId") REFERENCES "MeetingInvitation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingLobbyEntry"
  ADD CONSTRAINT "MeetingLobbyEntry_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingLobbyEntry"
  ADD CONSTRAINT "MeetingLobbyEntry_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "MeetingParticipant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingLobbyEntry"
  ADD CONSTRAINT "MeetingLobbyEntry_guestSessionId_fkey"
  FOREIGN KEY ("guestSessionId") REFERENCES "MeetingGuestSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingLobbyEntry"
  ADD CONSTRAINT "MeetingLobbyEntry_decidedByProfileId_fkey"
  FOREIGN KEY ("decidedByProfileId") REFERENCES "AdminUserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingAttendanceSession"
  ADD CONSTRAINT "MeetingAttendanceSession_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingAttendanceSession"
  ADD CONSTRAINT "MeetingAttendanceSession_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "MeetingParticipant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
