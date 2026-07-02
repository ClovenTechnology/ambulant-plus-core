from __future__ import annotations

import aiohttp

from .config import CaptionWorkerConfig
from .events import CaptionEvent


async def persist_caption_segment(cfg: CaptionWorkerConfig, event: CaptionEvent) -> None:
    if not cfg.persist:
        return
    if not event.encounterId:
        print("[caption-worker] skipping persistence: missing encounterId", event.roomId, event.type)
        return

    url = f"{cfg.api_gateway_url}/api/encounters/{event.encounterId}/collaborative-drafts"
    payload = {
        "title": "Caption transcript segment",
        "visitMode": "TELEVISIT",
        "mode": "TELEVISIT",
        "reason": "caption_transcript",
        "notes": event.to_payload(),
        "startsAt": event.startedAt or event.timestamp,
        "endsAt": event.endedAt or event.timestamp,
        "durationMin": None,
        "invitedClinicians": [],
        "source": "caption-worker",
    }

    headers = {
        "content-type": "application/json",
        "x-role": "system",
        "x-uid": cfg.worker_id,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=headers, timeout=20) as resp:
            if resp.status >= 400:
                text = await resp.text()
                raise RuntimeError(f"caption_persist_failed:{resp.status}:{text[:200]}")
