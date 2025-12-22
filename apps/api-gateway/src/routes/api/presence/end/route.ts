/**
 * POST /api/presence/end
 * Body: { sessionId }
 *
 * Returns: { ok }
 */
router.post('/end', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
return res.status(400).json({ ok: false, error: 'missing_sessionId' });
    }

    const now = new Date();
    await prisma.presenceSession.update({
      where: { id: sessionId },
      data: { endedAt: now, lastSeenAt: now },
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[presence] /end error', err);
    return res.status(200).json({ ok: false, error: 'session_not_found' });
  }
});
