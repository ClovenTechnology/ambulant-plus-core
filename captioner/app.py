import os
import asyncio
import json
import aiohttp
import numpy as np
import soundfile as sf

from livekit.agents import AutoSubscribe, WorkerOptions, cli, JobContext
from livekit.agents.audio import AudioBuffer
from livekit.agents.pipeline import vad
from livekit import rtc

# Config
LK_URL = os.getenv("LIVEKIT_WS_URL", "ws://127.0.0.1:7880")
LK_KEY = os.getenv("LIVEKIT_API_KEY", "devkey")
LK_SECRET = os.getenv("LIVEKIT_API_SECRET", "devsecret")
STT_ENDPOINT = os.getenv("STT_ENDPOINT", "http://whisper:9000/inference")
BOT_NAME = os.getenv("BOT_NAME", "CaptionBot")

# Simple VAD to chunk speech -> send to STT
VAD = vad.SileroVAD(sample_rate=16000)  # bundled with agents
TARGET_SR = 16000

async def stt_infer(session: aiohttp.ClientSession, pcm: np.ndarray):
    """
    Send PCM16 mono @ 16k to Whisper.cpp HTTP server.
    """
    # Write wav to memory
    import io
    mem = io.BytesIO()
    sf.write(mem, pcm, TARGET_SR, subtype="PCM_16", format="WAV")
    mem.seek(0)

    data = aiohttp.FormData()
    data.add_field("file", mem, filename="chunk.wav", content_type="audio/wav")
    # Add any whisper.cpp params here (language, prompt, etc.)
    async with session.post(STT_ENDPOINT, data=data, timeout=60) as resp:
        resp.raise_for_status()
        js = await resp.json()
        # whisper.cpp server returns segments; join text
        if isinstance(js, dict) and "result" in js:
            segs = js["result"].get("segments", [])
            txt = " ".join(s.get("text","").strip() for s in segs).strip()
            return txt
        return ""

async def handle_track(room: rtc.Room, pub: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
    if pub.kind != rtc.TrackKind.KIND_AUDIO:
        return

    print(f"[Captioner] Subscribed to audio from {participant.identity}")
    # downmix -> mono 16k
    resampler = rtc.AudioResampler(TARGET_SR, 1)

    buf = AudioBuffer(TARGET_SR, 1, max_duration=8.0)  # up to 8s windows
    last_emit = 0.0

    async with aiohttp.ClientSession() as session:
        @pub.on("track_subscribed")
        def _on_subscribed(track: rtc.RemoteAudioTrack):
            @track.on("audio_frame")
            def on_audio_frame(frame: rtc.AudioFrame):
                nonlocal last_emit
                pcm = resampler.process(frame)  # float32 -1..1, mono
                buf.push(pcm)

                # VAD gate
                if not VAD.is_speech(pcm):
                    # if ending speech, flush current buffer
                    if buf.duration > 0.8:  # at least ~0.8s of speech
                        asyncio.create_task(flush_buffer())
                    return

                # emit periodically while in speech
                if buf.duration - last_emit >= 3.0:  # every 3 seconds
                    last_emit = buf.duration
                    asyncio.create_task(flush_buffer(interim=True))

        async def flush_buffer(interim: bool=False):
            if buf.duration < 0.5:
                return
            pcm16 = buf.pop_all()  # float32 -> np.float32 mono
            pcm16 = np.clip(pcm16, -1.0, 1.0)
            pcm16 = (pcm16 * 32767).astype(np.int16)

            try:
                text = await stt_infer(session, pcm16)
                if text:
                    payload = json.dumps({
                        "type": "caption",
                        "from": BOT_NAME,
                        "text": text,
                        "interim": interim,
                    }).encode("utf-8")
                    await room.local_participant.publish_data(payload, kind=rtc.DataPacketKind.RELIABLE)
            except Exception as e:
                print("[Captioner] STT error:", e)

async def entrypoint(ctx: JobContext):
    """
    Agent joins any assigned room, subscribes to all audio, and broadcasts captions as data.
    """
    print("[Captioner] Starting…")
    room = await rtc.connect(
        LK_URL,
        token=rtc.AccessToken(LK_KEY, LK_SECRET).with_identity(BOT_NAME).with_grants(rtc.VideoGrants(room_join=True, room=ctx.room_name)).to_jwt()
    )

    @room.on("track_published")
    def on_pub(pub: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        # auto-subscribe to audio tracks
        if pub.kind == rtc.TrackKind.KIND_AUDIO and not pub.is_subscribed:
            pub.set_subscribed(True)

    @room.on("track_subscribed")
    def on_track(track: rtc.Track, pub: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        if isinstance(track, rtc.RemoteAudioTrack):
            asyncio.create_task(handle_track(room, pub, participant))

    print(f"[Captioner] Joined room as {BOT_NAME}. Waiting for audio…")
    await ctx.wait_for_stop()
    await room.disconnect()
    print("[Captioner] Stopped")

if __name__ == "__main__":
    # Run as a single-room worker that auto-subscribes
    cli.run_app(
        entrypoint,
        WorkerOptions(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    )