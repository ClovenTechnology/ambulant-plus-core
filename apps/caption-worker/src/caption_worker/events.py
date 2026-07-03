from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Mapping, Literal, Optional


CaptionType = Literal["caption.partial", "caption.final"]
SpeakerRole = Literal[
    "clinician",
    "patient",
    "parent",
    "guardian",
    "caregiver",
    "partner",
    "interpreter",
    "guest",
    "caption-worker",
    "system",
]
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


def _metadata_text(metadata: Mapping[str, Any] | None, *keys: str) -> str:
    if not metadata:
        return ""
    for key in keys:
        value = metadata.get(key)
        if value is not None:
            text = str(value).strip()
            if text:
                return text
    return ""


def infer_role(identity: str, metadata: Mapping[str, Any] | None = None) -> SpeakerRole:
    """
    Infer participant role from identity plus optional LiveKit metadata.

    Multiparty consults are not only multi-clinician. A room may include multiple
    patient-side participants: fertility partners, parents/guardians, caregivers,
    interpreters, or more than one patient joining from different locations.
    """
    ident = (identity or "").lower()
    meta_role = _metadata_text(
        metadata,
        "speakerRole",
        "participantRole",
        "role",
        "relationshipToPatient",
        "relationship",
        "participantType",
    ).lower()

    combined = f"{ident} {meta_role}".strip()

    if any(token in combined for token in ["caption", "caption-worker", "worker", "transcriber"]):
        return "caption-worker"

    if any(token in combined for token in ["system", "service"]):
        return "system"

    if any(token in combined for token in ["clinician", "doctor", "dr-", "dr_", "nurse", "therapist", "consultant", "gp"]):
        return "clinician"

    if any(token in combined for token in ["interpreter", "translator"]):
        return "interpreter"

    if any(token in combined for token in ["guardian", "legal-guardian"]):
        return "guardian"

    if any(token in combined for token in ["caregiver", "carer", "care-giver"]):
        return "caregiver"

    if any(token in combined for token in ["parent", "mother", "father", "mum", "mom", "dad"]):
        return "parent"

    if any(token in combined for token in ["partner", "spouse", "wife", "husband", "couple"]):
        return "partner"

    if "patient" in combined or ident.startswith("pt-") or ident.startswith("patient-"):
        return "patient"

    return "guest"


def display_name(identity: str, role: SpeakerRole, metadata: Mapping[str, Any] | None = None) -> str:
    explicit = _metadata_text(metadata, "speakerName", "displayName", "name", "fullName", "participantName")
    if explicit:
        return explicit

    cleaned = (identity or "").strip()
    if not cleaned:
        return role.replace("-", " ").title()

    if role == "clinician" and not cleaned.lower().startswith(("dr", "doctor", "nurse")):
        return "Dr " + cleaned

    return cleaned
