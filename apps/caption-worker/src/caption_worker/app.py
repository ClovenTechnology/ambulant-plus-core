from __future__ import annotations

import asyncio
import inspect
import json
from typing import Any, Mapping

from livekit import rtc
from livekit.agents import AutoSubscribe, WorkerOptions, cli, JobContext

from .config import CaptionWorkerConfig
from .events import CaptionEvent, display_name, infer_role
from .persistence import persist_caption_segment


TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1
BYTES_PER_SAMPLE = 2
MAX_BUFFER_SECONDS = 8.0
FLUSH_SECONDS = 3.0


class PcmSegmentBuffer:
    def __init__(self, sample_rate: int = TARGET_SAMPLE_RATE, channels: int = TARGET_CHANNELS) -> None:
        self.sample_rate = sample_rate
        self.channels = channels
        self._chunks: list[bytes] = []
        self._bytes = 0
        self._max_bytes = int(sample_rate * channels * BYTES_PER_SAMPLE * MAX_BUFFER_SECONDS)

    @property
    def duration(self) -> float:
        if self.sample_rate <= 0 or self.channels <= 0:
            return 0.0
        return self._bytes / float(self.sample_rate * self.channels * BYTES_PER_SAMPLE)

    def push_frame(self, frame: rtc.AudioFrame) -> None:
        data = bytes(frame.data)
        if not data:
            return

        self._chunks.append(data)
        self._bytes += len(data)

        while self._bytes > self._max_bytes and self._chunks:
            removed = self._chunks.pop(0)
            self._bytes -= len(removed)

    def pop_all(self) -> bytes:
        if not self._chunks:
            return b""
        joined = b"".join(self._chunks)
        self._chunks.clear()
        self._bytes = 0
        return joined


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


async def handle_audio_segment(
    cfg: CaptionWorkerConfig,
    room: rtc.Room,
    room_name: str,
    participant: rtc.RemoteParticipant,
    role: str,
    speaker_name: str,
    sequence: int,
    pcm: bytes,
) -> None:
    if not pcm:
        return

    seconds = len(pcm) / float(TARGET_SAMPLE_RATE * TARGET_CHANNELS * BYTES_PER_SAMPLE)
    print(
        "[caption-worker] audio segment ready",
        json.dumps(
            {
                "room": room_name,
                "speaker": speaker_name,
                "speakerRole": role,
                "speakerIdentity": _participant_identity(participant),
                "sequence": sequence,
                "seconds": round(seconds, 3),
                "bytes": len(pcm),
                "provider": cfg.provider,
            },
            separators=(",", ":"),
        ),
    )

    # Real transcription is intentionally not faked here.
    # The next patch wires this PCM segment into AWS Transcribe Medical and then
    # calls publish_caption(...) with actual transcript text returned by AWS.


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
    buffer = PcmSegmentBuffer(TARGET_SAMPLE_RATE, TARGET_CHANNELS)
    sequence = 0

    try:
        async for audio_event in stream:
            frame = getattr(audio_event, "frame", audio_event)
            if not isinstance(frame, rtc.AudioFrame):
                continue

            buffer.push_frame(frame)

            if buffer.duration >= FLUSH_SECONDS:
                sequence += 1
                pcm = buffer.pop_all()
                await handle_audio_segment(cfg, room, room_name, participant, role, name, sequence, pcm)
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
        try:
            await _maybe_await(stream.aclose())
        except Exception:
            pass


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
