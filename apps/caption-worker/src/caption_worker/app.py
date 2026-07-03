from __future__ import annotations

import asyncio
import inspect
import json
from typing import Any, AsyncIterator, Mapping

from livekit import rtc
from livekit.agents import AutoSubscribe, WorkerOptions, cli, JobContext

from .aws_transcribe import AwsTranscribeMedicalProvider
from .config import CaptionWorkerConfig
from .events import CaptionEvent, display_name, infer_role, utc_now_iso
from .persistence import persist_caption_segment


TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1
BYTES_PER_SAMPLE = 2
MAX_QUEUE_CHUNKS = 240


class PcmChunkQueue:
    def __init__(self, maxsize: int = MAX_QUEUE_CHUNKS) -> None:
        self._queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=maxsize)
        self._closed = False

    async def push(self, data: bytes) -> None:
        if self._closed or not data:
            return

        try:
            self._queue.put_nowait(data)
            return
        except asyncio.QueueFull:
            # Keep the stream live by dropping the oldest queued chunk rather
            # than letting a slow STT provider block LiveKit audio handling.
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                pass

        try:
            self._queue.put_nowait(data)
        except asyncio.QueueFull:
            pass

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            self._queue.put_nowait(None)
        except asyncio.QueueFull:
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            await self._queue.put(None)

    def __aiter__(self) -> AsyncIterator[bytes]:
        return self._iterate()

    async def _iterate(self) -> AsyncIterator[bytes]:
        while True:
            item = await self._queue.get()
            if item is None:
                break
            yield item


async def _maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


def _participant_metadata(participant: rtc.RemoteParticipant) -> dict[str, Any]:
    raw = getattr(participant, "metadata", None)
    if not raw:
        return {}

    if isinstance(raw, Mapping):
        return dict(raw)

    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    return {}


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


def _participant_identity(participant: rtc.RemoteParticipant) -> str:
    return str(getattr(participant, "identity", "") or "")


def _room_name_from_ctx(ctx: JobContext) -> str:
    room = getattr(ctx, "room", None)
    room_name = str(getattr(room, "name", "") or "")
    if room_name:
        return room_name

    job = getattr(ctx, "job", None)
    job_room = getattr(job, "room", None)
    job_room_name = str(getattr(job_room, "name", "") or "")
    if job_room_name:
        return job_room_name

    info = getattr(ctx, "info", None)
    info_room = getattr(info, "room", None)
    info_room_name = str(getattr(info_room, "name", "") or "")
    if info_room_name:
        return info_room_name

    return "unknown-room"


async def publish_caption(cfg: CaptionWorkerConfig, room: rtc.Room, event: CaptionEvent) -> None:
    payload = json.dumps(event.to_payload(), separators=(",", ":"))
    await _maybe_await(
        room.local_participant.publish_data(
            payload,
            reliable=bool(event.final),
            topic="captions",
        )
    )

    if event.final:
        await persist_caption_segment(cfg, event)


async def handle_transcription_results(
    cfg: CaptionWorkerConfig,
    room: rtc.Room,
    room_name: str,
    participant: rtc.RemoteParticipant,
    metadata: Mapping[str, Any],
    role: str,
    speaker_name: str,
    pcm_queue: PcmChunkQueue,
) -> None:
    provider = AwsTranscribeMedicalProvider(cfg)
    identity = _participant_identity(participant)
    encounter_id = _metadata_text(metadata, "encounterId", "encounter", "encounter_id")
    appointment_id = _metadata_text(metadata, "appointmentId", "appointment", "appointment_id", "appt")
    sequence = 0

    async for result in provider.transcribe_pcm_stream(pcm_queue):
        text = str(result.get("text") or "").strip()
        if not text:
            continue

        sequence += 1
        final = bool(result.get("final"))
        now = utc_now_iso()

        confidence = result.get("confidence")
        try:
            confidence_value = float(confidence) if confidence is not None else None
        except Exception:
            confidence_value = None

        event = CaptionEvent(
            type="caption.final" if final else "caption.partial",
            roomId=room_name,
            encounterId=encounter_id or None,
            appointmentId=appointment_id or None,
            speakerRole=role,  # type: ignore[arg-type]
            speakerIdentity=identity,
            speakerName=speaker_name,
            speakerDisplay=speaker_name,
            text=text,
            final=final,
            source=cfg.provider,  # type: ignore[arg-type]
            language=str(result.get("language") or cfg.language or ""),
            confidence=confidence_value,
            sequence=sequence,
            timestamp=now,
            startedAt=now,
            endedAt=now,
        )

        await publish_caption(cfg, room, event)


async def handle_track(
    cfg: CaptionWorkerConfig,
    room: rtc.Room,
    track: rtc.RemoteAudioTrack,
    participant: rtc.RemoteParticipant,
    room_name: str,
) -> None:
    identity = _participant_identity(participant)
    metadata = _participant_metadata(participant)
    role = infer_role(identity, metadata)
    name = display_name(identity, role, metadata)

    print(
        "[caption-worker] subscribed audio",
        json.dumps(
            {
                "room": room_name,
                "participant": identity,
                "speakerRole": role,
                "speakerName": name,
                "provider": cfg.provider,
            },
            separators=(",", ":"),
        ),
    )

    stream = rtc.AudioStream(
        track,
        sample_rate=TARGET_SAMPLE_RATE,
        num_channels=TARGET_CHANNELS,
        frame_size_ms=100,
    )
    pcm_queue = PcmChunkQueue()

    transcription_task = asyncio.create_task(
        handle_transcription_results(
            cfg,
            room,
            room_name,
            participant,
            metadata,
            role,
            name,
            pcm_queue,
        )
    )

    try:
        async for audio_event in stream:
            frame = getattr(audio_event, "frame", audio_event)
            if not isinstance(frame, rtc.AudioFrame):
                continue

            await pcm_queue.push(bytes(frame.data))

    except asyncio.CancelledError:
        raise
    except Exception as exc:
        print(
            "[caption-worker] audio track handler failed",
            json.dumps(
                {
                    "room": room_name,
                    "participant": identity,
                    "error": str(exc),
                },
                separators=(",", ":"),
            ),
        )
    finally:
        await pcm_queue.close()

        try:
            await _maybe_await(stream.aclose())
        except Exception:
            pass

        try:
            await asyncio.wait_for(transcription_task, timeout=12)
        except asyncio.TimeoutError:
            transcription_task.cancel()
            await asyncio.gather(transcription_task, return_exceptions=True)
        except Exception as exc:
            print(
                "[caption-worker] transcription task failed",
                json.dumps(
                    {
                        "room": room_name,
                        "participant": identity,
                        "error": str(exc),
                    },
                    separators=(",", ":"),
                ),
            )


async def _connect_job_context(ctx: JobContext) -> None:
    audio_only = getattr(AutoSubscribe, "AUDIO_ONLY", None)
    if audio_only is not None:
        try:
            await _maybe_await(ctx.connect(auto_subscribe=audio_only))
            return
        except TypeError:
            pass

    await _maybe_await(ctx.connect())


async def entrypoint(ctx: JobContext) -> None:
    cfg = CaptionWorkerConfig.from_env()
    room = ctx.room
    room_name = _room_name_from_ctx(ctx)
    active_tasks: set[asyncio.Task[None]] = set()
    stop_future: asyncio.Future[None] = asyncio.Future()

    print("[caption-worker] starting")
    print(
        "[caption-worker] config",
        json.dumps(
            {
                "provider": cfg.provider,
                "language": cfg.language,
                "medical": cfg.enable_medical,
                "persist": cfg.persist,
                "botName": cfg.bot_name,
                "medicalSpecialty": cfg.medical_specialty,
                "medicalType": cfg.medical_type,
            },
            separators=(",", ":"),
        ),
    )

    def register_task(task: asyncio.Task[None]) -> None:
        active_tasks.add(task)
        task.add_done_callback(lambda done: active_tasks.discard(done))

    @room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        if isinstance(track, rtc.RemoteAudioTrack):
            register_task(asyncio.create_task(handle_track(cfg, room, track, participant, room_name)))

    def stop_job(reason: str = "") -> None:
        if not stop_future.done():
            print("[caption-worker] shutdown requested", reason)
            stop_future.set_result(None)

    try:
        ctx.add_shutdown_callback(stop_job)
    except Exception:
        pass

    await _connect_job_context(ctx)
    room_name = _room_name_from_ctx(ctx)
    print(f"[caption-worker] joined room={room_name} as {cfg.bot_name}")

    try:
        await stop_future
    except asyncio.CancelledError:
        pass
    finally:
        for task in list(active_tasks):
            task.cancel()
        if active_tasks:
            await asyncio.gather(*active_tasks, return_exceptions=True)

        try:
            await _maybe_await(room.disconnect())
        except Exception:
            pass

        print("[caption-worker] stopped")


if __name__ == "__main__":
    cfg = CaptionWorkerConfig.from_env()
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            ws_url=cfg.livekit_url,
            api_key=cfg.livekit_api_key,
            api_secret=cfg.livekit_api_secret,
            agent_name=cfg.bot_name,
        )
    )
