/**
 * POST /api/presence/heartbeat
 * Body: { sessionId }
 *
 * Returns: { ok }
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'missing_sessionId' });
    }

    const now = new Date();
    await prisma.presenceSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: now },
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[presence] /heartbeat error', err);
    // If session not found, don’t scream — just return ok:false so client can restart
    return res.status(200).json({ ok: false, error: 'session_not_found' });
  }
});
