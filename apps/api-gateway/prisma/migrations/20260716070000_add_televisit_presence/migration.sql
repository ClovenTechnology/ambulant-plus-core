-- A6-R3-E1F-A: durable authenticated Televisit lobby and room presence

CREATE TABLE "TelevisitPresence" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "visitId" TEXT,
    "roomId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "participantRole" TEXT NOT NULL,
    "rtcRole" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRefId" TEXT,
    "displayName" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelevisitPresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelevisitPresence_appointmentId_participantId_surface_key"
ON "TelevisitPresence"("appointmentId", "participantId", "surface");

CREATE INDEX "TelevisitPresence_appointmentId_rtcRole_surface_expiresAt_idx"
ON "TelevisitPresence"("appointmentId", "rtcRole", "surface", "expiresAt");

CREATE INDEX "TelevisitPresence_appointmentId_surface_expiresAt_idx"
ON "TelevisitPresence"("appointmentId", "surface", "expiresAt");

CREATE INDEX "TelevisitPresence_roomId_surface_expiresAt_idx"
ON "TelevisitPresence"("roomId", "surface", "expiresAt");

CREATE INDEX "TelevisitPresence_visitId_surface_expiresAt_idx"
ON "TelevisitPresence"("visitId", "surface", "expiresAt");

CREATE INDEX "TelevisitPresence_participantId_expiresAt_idx"
ON "TelevisitPresence"("participantId", "expiresAt");
