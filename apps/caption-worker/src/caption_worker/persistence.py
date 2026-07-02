from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

import aiohttp

from .config import CaptionWorkerConfig
from .events import CaptionEvent


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _signed_identity_header(cfg: CaptionWorkerConfig) -> str | None:
    secret = (cfg.internal_identity_secret or "").strip()
    if not secret:
        return None

    now = int(time.time())
    payload = {
        "sub": cfg.worker_id,
        "uid": cfg.worker_id,
        "role": "system",
        "sid": "caption-worker",
        "iat": now,
        "nbf": now - 30,
        "exp": now + 300,
    }
    encoded_payload = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded_payload}.{_b64url(signature)}"


def _headers(cfg: CaptionWorkerConfig) -> dict[str, str]:
    headers = {
        "content-type": "application/json",
        "x-role": "system",
        "x-uid": cfg.worker_id,
    }

    signed = _signed_identity_header(cfg)
    if signed:
        headers["x-ambulant-identity"] = signed

    return headers


async def persist_caption_segment(cfg: CaptionWorkerConfig, event: CaptionEvent) -> None:
    if not cfg.persist:
        return
    if not event.encounterId:
        print("[caption-worker] skipping persistence: missing encounterId", event.roomId, event.type)
        return
    if not event.final:
        return

    url = f"{cfg.api_gateway_url}/api/encounters/{event.encounterId}/transcript"
    payload = event.to_payload()

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=_headers(cfg), timeout=20) as resp:
            if resp.status >= 400:
                text = await resp.text()
                raise RuntimeError(f"caption_persist_failed:{resp.status}:{text[:200]}")
