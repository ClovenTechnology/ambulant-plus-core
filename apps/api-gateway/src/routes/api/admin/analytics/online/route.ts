import { verifyAdminKeyOrToken } from '../lib/adminAuth'; // you can adapt to your verifyAdminToken logic

/**
 * GET /api/admin/analytics/online
 *
 * Optional query:
 *  - nowWindowSeconds (default 120)
 *  - date (ISO, default today)
 */
router.get('/admin/analytics/online', async (req, res) => {
  try {
    // Admin auth – you can adapt to your existing pattern (x-admin-key or JWT)
    const authOk = await verifyAdminKeyOrToken(req);
    if (!authOk) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const now = new Date();
    const nowWindowSeconds =
      Number(req.query.nowWindowSeconds ?? 120) || 120;

    const nowCutoff = new Date(now.getTime() - nowWindowSeconds * 1000);

    const todayStr = (req.query.date as string) || now.toISOString().slice(0, 10);
    const dayStart = new Date(`${todayStr}T00:00:00.000Z`);
    const monthStart = new Date(dayStart);
    monthStart.setUTCDate(1); // first of month

    // 1) sessions "online now"
    const sessionsNow = await prisma.presenceSession.findMany({
      where: {
        endedAt: null,
        lastSeenAt: { gte: nowCutoff },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 500, // safety cap
    });

    // 2) sessions overlapping today
    const sessionsToday = await prisma.presenceSession.findMany({
      where: {
        startedAt: { lte: now },    // started before now
        OR: [
          { endedAt: null },
          { endedAt: { gte: dayStart } }, // ended after start of day
        ],
      },
    });

    // 3) sessions overlapping current month
    const sessionsMonth = await prisma.presenceSession.findMany({
      where: {
        startedAt: { lte: now },
        OR: [
          { endedAt: null },
          { endedAt: { gte: monthStart } },
        ],
      },
    });

    function accumulateDurations(
      sessions: typeof sessionsToday,
      windowStart: Date,
      windowEnd: Date,
    ) {
      type Acc = {
        [actorType: string]: {
          userIds: Set<string>;
          totalSeconds: number;
          minSeconds: number;
          maxSeconds: number;
        };
      };

      const acc: Acc = {};
      for (const s of sessions) {
        const actor = s.actorType;
        if (!acc[actor]) {
          acc[actor] = {
            userIds: new Set(),
            totalSeconds: 0,
            minSeconds: Number.POSITIVE_INFINITY,
            maxSeconds: 0,
          };
        }

        const start = s.startedAt < windowStart ? windowStart : s.startedAt;
        const endRaw = s.endedAt ?? windowEnd;
        const end = endRaw > windowEnd ? windowEnd : endRaw;
        if (end <= start) continue;

        const seconds = (end.getTime() - start.getTime()) / 1000;
        acc[actor].userIds.add(s.userId);
        acc[actor].totalSeconds += seconds;
        acc[actor].minSeconds = Math.min(acc[actor].minSeconds, seconds);
        acc[actor].maxSeconds = Math.max(acc[actor].maxSeconds, seconds);
      }

      return Object.entries(acc).map(([actorType, v]) => {
        const userCount = v.userIds.size || 1; // avoid divide-by-zero
        return {
          actorType,
          users: v.userIds.size,
          totalSeconds: v.totalSeconds,
          avgSeconds: v.totalSeconds / userCount,
          minSeconds:
            v.minSeconds === Number.POSITIVE_INFINITY ? 0 : v.minSeconds,
          maxSeconds: v.maxSeconds,
        };
      });
    }

    const todaySummary = accumulateDurations(
      sessionsToday,
      dayStart,
      now,
    );
    const monthSummary = accumulateDurations(
      sessionsMonth,
      monthStart,
      now,
    );

    // Geo breakdown (today)
    type GeoKey = string;
    const geoMap = new Map<
      GeoKey,
      { country: string; actorType: string; users: Set<string> }
    >();

    for (const s of sessionsToday) {
      const country = s.ipCountry || 'Unknown';
      const key = `${country}:${s.actorType}`;
      if (!geoMap.has(key)) {
        geoMap.set(key, {
          country,
          actorType: s.actorType,
          users: new Set(),
        });
      }
      geoMap.get(key)!.users.add(s.userId);
    }

    const byGeoToday = Array.from(geoMap.values()).map((g) => ({
      country: g.country,
      actorType: g.actorType,
      totalUsers: g.users.size,
    }));

    // Now summary
    const byActorNowMap = new Map<string, number>();
    for (const s of sessionsNow) {
      byActorNowMap.set(
        s.actorType,
        (byActorNowMap.get(s.actorType) ?? 0) + 1,
      );
    }
    const byActorNow = Array.from(byActorNowMap.entries()).map(
      ([actorType, count]) => ({ actorType, count }),
    );

    const payload = {
      ok: true,
      now: {
        totalOnline: sessionsNow.length,
        byActorType: byActorNow,
      },
      today: todaySummary,
      thisMonth: monthSummary,
      byGeoToday,
      sessionsNow: sessionsNow.map((s) => ({
        id: s.id,
        userId: s.userId,
        actorType: s.actorType,
        actorRefId: s.actorRefId,
        app: s.app,
        startedAt: s.startedAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        ipCountry: s.ipCountry,
        ipCity: s.ipCity,
      })),
    };

    return res.json(payload);
  } catch (err: any) {
    console.error('[presence] /admin/analytics/online error', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
