from __future__ import annotations

import asyncio
import json
from typing import Optional

import numpy as np

from livekit.agents import AutoSubscribe, WorkerOptions, cli, JobContext
from livekit.agents.audio import AudioBuffer
from livekit.agents.pipeline import vad
from livekit import rtc

from .config import CaptionWorkerConfig
from .events import CaptionEvent, display_name, infer_role, utc_now_iso
from .persistence import persist_caption_segment


TARGET_SAMPLE_RATE = 16000
MAX_BUFFER_SECONDS = 8.0

CFG = CaptionWorkerConfig.from_env()
VAD = vad.SileroVAD(sample_rate=TARGET_SAMPLE_RATE)


async def publish_caption(room: rtc.Room, event: CaptionEvent) -> None:
    payload = json.dumps(event.to_payload(), separators=(",", ":")).encode("utf-8")
    kind = rtc.DataPacketKind.RELIABLE if event.final else rtc.DataPacketKind.LOSSY
    await room.local_participant.publish_data(payload, kind=kind, topic="captions")
    if event.final:
        await persist_caption_segment(CFG, event)


async def handle_track(room: rtc.Room, track: rtc.RemoteAudioTrack, participant: rtc.RemoteParticipant, room_name: str) -> None:
    identity = participant.identity or ""
    role = infer_role(identity)
    name = display_name(identity, role)
    print(f"[caption-worker] subscribed audio: room={room_name} participant={identity} role={role}")

    resampler = rtc.AudioResampler(TARGET_SAMPLE_RATE, 1)
    buffer = AudioBuffer(TARGET_SAMPLE_RATE, 1, max_duration=MAX_BUFFER_SECONDS)
    sequence = 0

    async def flush_buffer(final: bool) -> None:
        nonlocal sequence
        if buffer.duration < 0.5:
            return

        pcm = buffer.pop_all()
        pcm = np.clip(pcm, -1.0, 1.0)

        # Sweep 5B2 will send pcm to AWS Transcribe Medical and publish the
        # returned transcript text. This foundation event proves the route,
        # topic, participant attribution, and persistence shape without fake
        # medical transcription text.
        sequence += 1
        if final:
            print(f"[caption-worker] audio segment ready for AWS: room={room_name} speaker={name} seq={sequence}")

    @track.on("audio_frame")
    def on_audio_frame(frame: rtc.AudioFrame) -> None:
        pcm = resampler.process(frame)
        buffer.push(pcm)

        if not VAD.is_speech(pcm):
            if buffer.duration > 0.8:
                asyncio.create_task(flush_buffer(final=True))
            return

        if buffer.duration >= 3.0:
            asyncio.create_task(flush_buffer(final=False))


async def entrypoint(ctx: JobContext) -> None:
    print("[caption-worker] starting")
    print(f"[caption-worker] provider={CFG.provider} language={CFG.language} medical={CFG.enable_medical} persist={CFG.persist}")

    room_name = ctx.room_name
    token = (
        rtc.AccessToken(CFG.livekit_api_key, CFG.livekit_api_secret)
        .with_identity(CFG.bot_name)
        .with_grants(
            rtc.VideoGrants(
                room_join=True,
                room=room_name,
                can_subscribe=True,
                can_publish=False,
                can_publish_data=True,
            )
        )
        .to_jwt()
    )

    room = await rtc.connect(CFG.livekit_url, token=token)

    @room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant) -> None:
        if isinstance(track, rtc.RemoteAudioTrack):
            asyncio.create_task(handle_track(room, track, participant, room_name))

    print(f"[caption-worker] joined room={room_name} as {CFG.bot_name}")
    await ctx.wait_for_stop()
    await room.disconnect()
    print("[caption-worker] stopped")


if __name__ == "__main__":
    cli.run_app(
        entrypoint,
        WorkerOptions(auto_subscribe=AutoSubscribe.AUDIO_ONLY),
    )
