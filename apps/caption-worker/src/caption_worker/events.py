from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Literal, Optional


CaptionType = Literal["caption.partial", "caption.final"]
SpeakerRole = Literal["clinician", "patient", "guest", "caption-worker", "system"]
CaptionSource = Literal["aws-transcribe-medical", "aws-transcribe-standard", "livekit-agent", "manual", "unknown"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass
class CaptionEvent:
    type: CaptionType
    roomId: str
    speakerRole: SpeakerRole
    speakerName: str
    speakerDisplay: str
    text: str
    final: bool
    source: CaptionSource
    sequence: int
    timestamp: str
    encounterId: Optional[str] = None
    appointmentId: Optional[str] = None
    speakerIdentity: Optional[str] = None
    language: Optional[str] = None
    confidence: Optional[float] = None
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None

    def to_payload(self) -> dict:
        return asdict(self)


def infer_role(identity: str) -> SpeakerRole:
    ident = (identity or "").lower()
    if "clinician" in ident or ident.startswith("dr-") or ident.startswith("doctor"):
        return "clinician"
    if "patient" in ident:
        return "patient"
    if "caption" in ident or "worker" in ident:
        return "caption-worker"
    return "guest"


def display_name(identity: str, role: SpeakerRole) -> str:
    cleaned = (identity or "").strip()
    if not cleaned:
        return role.replace("-", " ").title()
    if role == "clinician" and not cleaned.lower().startswith("dr"):
        return "Dr " + cleaned
    return cleaned
