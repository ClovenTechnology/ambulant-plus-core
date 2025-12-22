import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { getClientInfo } from '../lib/httpUtils';

const router = Router();

/**
 * POST /api/presence/start
 * Body: { actorType, actorRefId?, app }
 *
 * Returns: { ok, sessionId }
 */
router.post('/start', async (req, res) => {
  try {
    const { actorType, actorRefId, app } = req.body || {};

    if (!actorType || !app) {
      return res.status(400).json({ ok: false, error: 'missing_actorType_or_app' });
    }

    // TODO: plug in your auth — this is where you map from Auth0 / session -> userId
    // For now we accept a best-effort header, but you should replace this.
    const userId =
      (req as any).auth?.sub || // e.g. from middleware
      (req.headers['x-user-id'] as string) ||
      null;

    if (!userId) {
      return res.status(401).json({ ok: false, error: 'missing_userId' });
    }

    const { userAgent, ipCountry, ipCity } = getClientInfo(req);

    // Optionally: reuse an existing active session for this user/app/actorType
    const now = new Date();
    const existing = await prisma.presenceSession.findFirst({
      where: {
        userId,
        actorType,
        app,
        endedAt: null,
      },
      orderBy: { startedAt: 'desc' },
    });

    let session;
    if (existing) {
      session = await prisma.presenceSession.update({
        where: { id: existing.id },
        data: { lastSeenAt: now },
      });
    } else {
      session = await prisma.presenceSession.create({
        data: {
          userId,
          actorType,
          actorRefId: actorRefId ?? null,
          app,
          startedAt: now,
          lastSeenAt: now,
          ipCountry,
          ipCity,
          userAgent,
        },
      });
    }

    return res.json({ ok: true, sessionId: session.id });
  } catch (err: any) {
    console.error('[presence] /start error', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});
