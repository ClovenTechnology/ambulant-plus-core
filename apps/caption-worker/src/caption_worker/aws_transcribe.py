from __future__ import annotations

import asyncio
import json
import struct
import urllib.parse
import uuid
import zlib
from typing import Any, AsyncIterable, AsyncIterator, Mapping

import aiohttp
from amazon_transcribe.client import TranscribeStreamingClient
from botocore.auth import SigV4QueryAuth
from botocore.awsrequest import AWSRequest
from botocore.eventstream import EventStreamBuffer
from botocore.session import get_session

from .config import CaptionWorkerConfig


TARGET_SAMPLE_RATE = 16000
MEDIA_ENCODING = "pcm"
AWS_EVENT_HEADER_STRING = 7


def _header_value(headers: Mapping[str, Any], name: str) -> Any:
    value = headers.get(name)
    return getattr(value, "value", value)


def _string_header(name: str, value: str) -> bytes:
    name_bytes = name.encode("utf-8")
    value_bytes = value.encode("utf-8")
    return (
        bytes([len(name_bytes)])
        + name_bytes
        + bytes([AWS_EVENT_HEADER_STRING])
        + struct.pack("!H", len(value_bytes))
        + value_bytes
    )


def _event_stream_message(headers: Mapping[str, str], payload: bytes) -> bytes:
    header_bytes = b"".join(_string_header(name, value) for name, value in headers.items())
    total_len = 16 + len(header_bytes) + len(payload)
    prelude = struct.pack("!II", total_len, len(header_bytes))
    prelude_crc = struct.pack("!I", zlib.crc32(prelude) & 0xFFFFFFFF)
    message_without_crc = prelude + prelude_crc + header_bytes + payload
    message_crc = struct.pack("!I", zlib.crc32(message_without_crc) & 0xFFFFFFFF)
    return message_without_crc + message_crc


def _audio_event(audio_chunk: bytes) -> bytes:
    return _event_stream_message(
        {
            ":message-type": "event",
            ":event-type": "AudioEvent",
            ":content-type": "application/octet-stream",
        },
        audio_chunk,
    )


def _coerce_pcm_bytes(chunk: Any) -> bytes:
    if chunk is None:
        return b""
    if isinstance(chunk, bytes):
        return chunk
    if isinstance(chunk, bytearray):
        return bytes(chunk)
    if isinstance(chunk, memoryview):
        return chunk.tobytes()

    # Compatibility for older numpy ndarray callers without making numpy a hard
    # dependency of this provider implementation.
    tobytes = getattr(chunk, "tobytes", None)
    if callable(tobytes):
        return bytes(tobytes())

    return bytes(chunk)


def _confidence_from_items(items: list[Any]) -> float | None:
    values: list[float] = []
    for item in items:
        confidence = getattr(item, "confidence", None)
        if confidence is None and isinstance(item, Mapping):
            confidence = item.get("Confidence") or item.get("confidence")
        try:
            value = float(confidence)
        except Exception:
            continue
        if 0 <= value <= 1:
            values.append(value)

    if not values:
        return None

    return sum(values) / len(values)


def _mapping_value(value: Any, *keys: str) -> Any:
    if not isinstance(value, Mapping):
        return None

    for key in keys:
        if key in value:
            return value.get(key)

    return None


def _object_or_mapping_value(value: Any, attr: str, *keys: str) -> Any:
    if isinstance(value, Mapping):
        return _mapping_value(value, *keys)

    return getattr(value, attr, None)


def _coerce_list(value: Any) -> list[Any]:
    if value is None:
        return []

    if callable(value):
        return []

    if isinstance(value, list):
        return value

    if isinstance(value, tuple):
        return list(value)

    try:
        return list(value)
    except Exception:
        return []


def _result_to_dict(result: Any) -> dict[str, Any] | None:
    alternatives = _object_or_mapping_value(result, "alternatives", "Alternatives", "alternatives")
    alternatives_list = _coerce_list(alternatives)

    if not alternatives_list:
        return None

    alternative = alternatives_list[0]
    transcript = _object_or_mapping_value(alternative, "transcript", "Transcript", "transcript")

    text = str(transcript or "").strip()
    if not text:
        return None

    items = _object_or_mapping_value(alternative, "items", "Items", "items")
    items_list = _coerce_list(items)

    is_partial = _object_or_mapping_value(result, "is_partial", "IsPartial", "is_partial")
    start_time = _object_or_mapping_value(result, "start_time", "StartTime", "start_time")
    end_time = _object_or_mapping_value(result, "end_time", "EndTime", "end_time")
    result_id = _object_or_mapping_value(result, "result_id", "ResultId", "result_id")
    language_code = _object_or_mapping_value(result, "language_code", "LanguageCode", "language_code")

    return {
        "text": text,
        "final": not bool(is_partial),
        "resultId": result_id,
        "startTime": start_time,
        "endTime": end_time,
        "language": language_code,
        "confidence": _confidence_from_items(items_list),
    }


def _parse_medical_transcript_payload(payload: bytes) -> list[dict[str, Any]]:
    if not payload:
        return []

    data = json.loads(payload.decode("utf-8"))
    transcript = data.get("Transcript") or data.get("transcript") or {}
    results = transcript.get("Results") or transcript.get("results") or []

    out: list[dict[str, Any]] = []
    for result in results:
        item = _result_to_dict(result)
        if item:
            out.append(item)

    return out


def _presigned_medical_ws_url(cfg: CaptionWorkerConfig) -> str:
    session = get_session()
    credentials = session.get_credentials()
    if credentials is None:
        raise RuntimeError(
            "aws_credentials_missing: set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or attach an IAM role"
        )

    frozen = credentials.get_frozen_credentials()
    region = cfg.aws_region or "eu-west-1"
    session_id = f"ambulant-caption-{uuid.uuid4().hex[:24]}"

    host = f"transcribestreaming.{region}.amazonaws.com:8443"
    path = "/medical-stream-transcription-websocket"

    params = {
        "language-code": cfg.language,
        "media-encoding": MEDIA_ENCODING,
        "sample-rate": str(TARGET_SAMPLE_RATE),
        "specialty": cfg.medical_specialty or "PRIMARYCARE",
        "type": cfg.medical_type or "CONVERSATION",
        "session-id": session_id,
        "enable-partial-results-stabilization": "true",
        "partial-results-stability": "medium",
    }

    query = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    unsigned_url = f"https://{host}{path}?{query}"

    request = AWSRequest(method="GET", url=unsigned_url)
    SigV4QueryAuth(frozen, "transcribe", region, expires=300).add_auth(request)

    return str(request.url).replace("https://", "wss://", 1)


class AwsTranscribeMedicalProvider:
    """
    AWS STT provider for Ambulant+ caption-worker.

    - aws-transcribe-medical uses the real StartMedicalStreamTranscription
      WebSocket route because the installed Python streaming SDK exposes only
      the standard StartStreamTranscription helper.
    - aws-transcribe-standard uses the installed async TranscribeStreamingClient.
    """

    def __init__(self, cfg: CaptionWorkerConfig) -> None:
        self.cfg = cfg

    async def transcribe_pcm_stream(self, pcm_chunks: AsyncIterable[bytes]) -> AsyncIterator[dict[str, Any]]:
        provider = (self.cfg.provider or "").strip().lower()

        if provider == "aws-transcribe-medical":
            async for item in self._transcribe_medical_websocket(pcm_chunks):
                yield item
            return

        if provider == "aws-transcribe-standard":
            async for item in self._transcribe_standard_sdk(pcm_chunks):
                yield item
            return

        raise RuntimeError(f"unsupported_caption_provider:{self.cfg.provider}")

    async def _send_medical_audio(self, ws: aiohttp.ClientWebSocketResponse, pcm_chunks: AsyncIterable[bytes]) -> None:
        try:
            async for chunk in pcm_chunks:
                pcm = _coerce_pcm_bytes(chunk)
                if not pcm:
                    continue
                await ws.send_bytes(_audio_event(pcm))
        finally:
            # Empty AudioEvent signals end-of-stream to Amazon Transcribe.
            if not ws.closed:
                await ws.send_bytes(_audio_event(b""))

    async def _transcribe_medical_websocket(self, pcm_chunks: AsyncIterable[bytes]) -> AsyncIterator[dict[str, Any]]:
        if self.cfg.language != "en-US":
            raise RuntimeError("aws-transcribe-medical requires CAPTION_LANGUAGE=en-US")

        url = _presigned_medical_ws_url(self.cfg)
        event_buffer = EventStreamBuffer()

        timeout = aiohttp.ClientTimeout(total=None, sock_connect=20, sock_read=None)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.ws_connect(url, max_msg_size=0, heartbeat=20) as ws:
                sender = asyncio.create_task(self._send_medical_audio(ws, pcm_chunks))

                try:
                    while True:
                        try:
                            receive_timeout = 10 if sender.done() else None
                            msg = await ws.receive(timeout=receive_timeout)
                        except asyncio.TimeoutError:
                            if sender.done():
                                break
                            continue

                        if msg.type == aiohttp.WSMsgType.BINARY:
                            event_buffer.add_data(msg.data)

                            for event in event_buffer:
                                headers = event.headers
                                message_type = _header_value(headers, ":message-type")
                                event_type = _header_value(headers, ":event-type")

                                if message_type == "exception":
                                    detail = event.payload.decode("utf-8", errors="replace")
                                    raise RuntimeError(f"aws_transcribe_medical_exception:{detail[:500]}")

                                if event_type != "TranscriptEvent":
                                    continue

                                for item in _parse_medical_transcript_payload(event.payload):
                                    yield item

                        elif msg.type == aiohttp.WSMsgType.TEXT:
                            # The service should return event-stream binary messages.
                            # Keep this only as defensive logging data.
                            raise RuntimeError(f"unexpected_aws_transcribe_text_frame:{str(msg.data)[:200]}")

                        elif msg.type == aiohttp.WSMsgType.ERROR:
                            raise RuntimeError(f"aws_transcribe_websocket_error:{ws.exception()}")

                        elif msg.type in (
                            aiohttp.WSMsgType.CLOSE,
                            aiohttp.WSMsgType.CLOSED,
                            aiohttp.WSMsgType.CLOSING,
                        ):
                            break

                    if sender.done():
                        exc = sender.exception()
                        if exc:
                            raise exc
                finally:
                    if not sender.done():
                        sender.cancel()
                        await asyncio.gather(sender, return_exceptions=True)

                    if not ws.closed:
                        await ws.close()

    async def _send_standard_audio(self, stream: Any, pcm_chunks: AsyncIterable[bytes]) -> None:
        try:
            async for chunk in pcm_chunks:
                pcm = _coerce_pcm_bytes(chunk)
                if not pcm:
                    continue
                await stream.input_stream.send_audio_event(audio_chunk=pcm)
        finally:
            await stream.input_stream.end_stream()

    async def _transcribe_standard_sdk(self, pcm_chunks: AsyncIterable[bytes]) -> AsyncIterator[dict[str, Any]]:
        client = TranscribeStreamingClient(region=self.cfg.aws_region or "eu-west-1")

        stream = await client.start_stream_transcription(
            language_code=self.cfg.language,
            media_sample_rate_hz=TARGET_SAMPLE_RATE,
            media_encoding=MEDIA_ENCODING,
            show_speaker_label=False,
            enable_partial_results_stabilization=True,
            partial_results_stability="medium",
        )

        sender = asyncio.create_task(self._send_standard_audio(stream, pcm_chunks))

        try:
            async for event in stream.output_stream:
                transcript = getattr(event, "transcript", None)
                if not transcript:
                    continue

                results = getattr(transcript, "results", None) or []
                for result in results:
                    item = _result_to_dict(result)
                    if item:
                        yield item

            if sender.done():
                exc = sender.exception()
                if exc:
                    raise exc
        finally:
            if not sender.done():
                sender.cancel()
                await asyncio.gather(sender, return_exceptions=True)
