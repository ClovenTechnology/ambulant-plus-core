from __future__ import annotations

import argparse
import asyncio
import json
from typing import Any, AsyncIterator

from .app import PcmChunkQueue
from .aws_transcribe import _audio_event, _parse_medical_transcript_payload
from .events import CaptionEvent, display_name, infer_role, utc_now_iso


class FakeLocalParticipant:
    def __init__(self) -> None:
        self.published: list[dict[str, Any]] = []

    async def publish_data(self, payload: str, reliable: bool = True, topic: str = "") -> None:
        self.published.append(
            {
                "payload": json.loads(payload),
                "reliable": reliable,
                "topic": topic,
            }
        )


class FakeRoom:
    def __init__(self) -> None:
        self.local_participant = FakeLocalParticipant()


def sample_metadata(role: str) -> dict[str, Any]:
    return {
        "participantRole": role,
        "speakerRole": role,
        "displayName": {
            "clinician": "Dr Test Clinician",
            "patient": "Mary Patient",
            "parent": "Mrs Parent",
            "caregiver": "Anna Caregiver",
            "partner": "John Partner",
            "interpreter": "Zulu Interpreter",
        }.get(role, f"{role.title()} Test"),
        "participantName": {
            "clinician": "Dr Test Clinician",
            "patient": "Mary Patient",
            "parent": "Mrs Parent",
            "caregiver": "Anna Caregiver",
            "partner": "John Partner",
            "interpreter": "Zulu Interpreter",
        }.get(role, f"{role.title()} Test"),
        "relationshipToPatient": "" if role in ("clinician", "patient") else role,
        "encounterId": "enc-smoke-001",
        "appointmentId": "appt-smoke-001",
        "visitId": "visit-smoke-001",
        "roomId": "room-smoke-001",
        "authRole": "clinician" if role == "clinician" else "patient",
        "uid": f"{role}-smoke-001",
    }


def sample_medical_payload(text: str, is_partial: bool = False) -> bytes:
    return json.dumps(
        {
            "Transcript": {
                "Results": [
                    {
                        "ResultId": "result-smoke-001",
                        "StartTime": 0.0,
                        "EndTime": 1.25,
                        "IsPartial": is_partial,
                        "Alternatives": [
                            {
                                "Transcript": text,
                                "Items": [
                                    {
                                        "StartTime": 0.0,
                                        "EndTime": 1.25,
                                        "Type": "pronunciation",
                                        "Content": text.split()[0] if text.split() else text,
                                        "Confidence": 0.97,
                                    }
                                ],
                            }
                        ],
                    }
                ]
            }
        }
    ).encode("utf-8")


async def exercise_pcm_queue() -> dict[str, Any]:
    queue = PcmChunkQueue(maxsize=2)
    await queue.push(b"one")
    await queue.push(b"two")
    await queue.push(b"three")
    await queue.close()

    drained: list[str] = []
    async for item in queue:
        drained.append(item.decode("utf-8"))

    return {
        "queueMaxsize": 2,
        "drained": drained,
        "dropOldestWorked": drained == ["two", "three"],
    }


async def fake_results() -> AsyncIterator[dict[str, Any]]:
    yield {
        "text": "The patient reports chest discomfort",
        "final": False,
        "language": "en-US",
        "confidence": 0.91,
    }
    yield {
        "text": "The patient reports chest discomfort for two days",
        "final": True,
        "language": "en-US",
        "confidence": 0.96,
    }


async def exercise_caption_events(role: str) -> dict[str, Any]:
    metadata = sample_metadata(role)
    identity = metadata["uid"]
    speaker_role = infer_role(identity, metadata)
    speaker_name = display_name(identity, speaker_role, metadata)

    room = FakeRoom()
    sequence = 0

    for result in [
        {
            "text": "The patient reports chest discomfort",
            "final": False,
            "language": "en-US",
            "confidence": 0.91,
        },
        {
            "text": "The patient reports chest discomfort for two days",
            "final": True,
            "language": "en-US",
            "confidence": 0.96,
        },
    ]:
        sequence += 1
        now = utc_now_iso()
        event = CaptionEvent(
            type="caption.final" if result["final"] else "caption.partial",
            roomId="room-smoke-001",
            encounterId=metadata["encounterId"],
            appointmentId=metadata["appointmentId"],
            speakerRole=speaker_role,
            speakerIdentity=identity,
            speakerName=speaker_name,
            speakerDisplay=speaker_name,
            text=result["text"],
            final=bool(result["final"]),
            source="aws-transcribe-medical",
            language=str(result["language"]),
            confidence=float(result["confidence"]),
            sequence=sequence,
            timestamp=now,
            startedAt=now,
            endedAt=now,
        )

        await room.local_participant.publish_data(
            json.dumps(event.to_payload(), separators=(",", ":")),
            reliable=event.final,
            topic="captions",
        )

    return {
        "identity": identity,
        "speakerRole": speaker_role,
        "speakerName": speaker_name,
        "published": room.local_participant.published,
    }


def exercise_aws_eventstream_helpers() -> dict[str, Any]:
    audio = _audio_event(b"abc")
    parsed_final = _parse_medical_transcript_payload(
        sample_medical_payload("Hello from medical transcription", is_partial=False)
    )
    parsed_partial = _parse_medical_transcript_payload(
        sample_medical_payload("Hello from medical", is_partial=True)
    )

    return {
        "audioEventBytes": len(audio),
        "audioEventPreludeHex": audio[:4].hex(),
        "parsedFinal": parsed_final,
        "parsedPartial": parsed_partial,
    }


async def main() -> None:
    parser = argparse.ArgumentParser(description="Ambulant+ caption-worker local smoke harness")
    parser.add_argument(
        "--role",
        default="parent",
        choices=["clinician", "patient", "parent", "guardian", "caregiver", "partner", "interpreter", "guest"],
        help="Participant role to simulate",
    )
    args = parser.parse_args()

    output = {
        "ok": True,
        "role": args.role,
        "queue": await exercise_pcm_queue(),
        "captionEvents": await exercise_caption_events(args.role),
        "awsEventstream": exercise_aws_eventstream_helpers(),
    }

    print(json.dumps(output, indent=2, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
