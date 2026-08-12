/**
 * Shared low-level LiveKit token minting for Admin RTC domains.
 *
 * Domain admission belongs to the caller:
 * - scheduled Meeting code applies Meeting schedule/lock semantics;
 * - Direct Call code applies immediate-call state/participant semantics.
 *
 * This module owns only transport credential minting.
 */

function envFirst(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }

  return '';
}

export async function mintAdminLiveKitAccess(input: {
  roomId: string;
  identity: string;
  displayName: string;
  metadata: Record<string, unknown>;
  roomAdmin: boolean;
}) {
  const key = envFirst([
    'LIVEKIT_API_KEY',
    'LK_API_KEY',
  ]);

  const secret = envFirst([
    'LIVEKIT_API_SECRET',
    'LK_API_SECRET',
  ]);

  const wsUrl = envFirst([
    'LIVEKIT_WS_URL',
    'LIVEKIT_URL',
    'LK_WS_URL',
    'LK_URL',
  ]);

  if (!key || !secret || !wsUrl) {
    throw new Error('server_misconfig_missing_livekit_creds');
  }

  const { AccessToken } =
    await import(
      'livekit-server-sdk'
    );

  const at =
    new AccessToken(
      key,
      secret,
      {
        identity: input.identity,
        name: input.displayName,
        ttl: '15m',
        metadata: JSON.stringify(input.metadata),
      },
    );

  at.addGrant({
    room: input.roomId,
    roomJoin: true,
    roomAdmin: input.roomAdmin,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    token: await at.toJwt(),
    wsUrl,
    roomId: input.roomId,
    metadata: input.metadata,
  };
}
