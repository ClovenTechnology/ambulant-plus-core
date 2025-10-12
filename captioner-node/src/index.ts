import { Room, RoomEvent, setLogLevel, LogLevel, setWRTC, setWebSocket } from "livekit-client";
import WebSocket from "ws";
import wrtc from "wrtc";
import fetch from "node-fetch";
import FormData from "form-data";

setLogLevel(LogLevel.warn);
setWRTC(wrtc as any);
setWebSocket(WebSocket as any);

const url = process.env.LIVEKIT_URL ?? "ws://127.0.0.1:7880";
const apiKey = process.env.LIVEKIT_API_KEY ?? "devkey";
const apiSecret = process.env.LIVEKIT_API_SECRET ?? "devsecret";

const provider = (process.env.CAPTION_PROVIDER ?? "deepgram").toLowerCase(); // deepgram | whisper
const deepgramKey = process.env.DEEPGRAM_API_KEY ?? "";
const deepgramModel = process.env.DEEPGRAM_MODEL ?? "nova-2-general";
const deepgramLanguage = process.env.DEEPGRAM_LANGUAGE ?? "en";
const whisperUrl = process.env.WHISPER_HTTP_URL ?? "http://127.0.0.1:9000";

function usage() {
  console.log("Usage: node dist/index.js --room ROOM --identity BOTNAME");
}

const args = new Map<string,string>();
for (let i=2;i<process.argv.length;i+=2) { args.set(process.argv[i], process.argv[i+1]); }
const roomName = args.get("--room") || "testroom";
const identity = args.get("--identity") || "CaptionBot";

function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

async function getToken(room: string, identity: string): Promise<string> {
  // Minimal JWT builder (LiveKit dev server accepts "devkey/devsecret" placeholder) – use your Next route in prod
  const claims = {
    video: { roomJoin: true, room, canPublish: false, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: true },
    sub: identity
  };
  // Quick 'n dirty: request server's /?access_token via placeholder dev mode
  // For dev server: empty token joins too, but we’ll keep it explicit by hitting your Next API if desired.
  // If your /api/rtc/token is reachable, prefer that:
  return ""; // Empty is OK for --dev server keys; if you want JWT, wire your Next API here.
}

type TrackCtx = {
  id: string;
  recorder?: MediaRecorder;
  chunks: Buffer[];
  dgSocket?: WebSocket;
};

const tracks = new Map<string, TrackCtx>();

async function ensureDeepgram(room: Room, ctx: TrackCtx) {
  if (!deepgramKey) return; // will fall back later
  const qs = new URLSearchParams({
    model: deepgramModel,
    language: deepgramLanguage,
    smart_format: "true",
    interim_results: "true",
    punctuate: "true",
    diarize: "false"
  });
  const dgUrl = `wss://api.deepgram.com/v1/listen?${qs.toString()}`;
  const ws = new WebSocket(dgUrl, {
    headers: { Authorization: `Token ${deepgramKey}` }
  });
  ctx.dgSocket = ws;
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const alt = msg?.channel?.alternatives?.[0];
      const text = alt?.transcript || "";
      const isFinal = msg?.is_final === true || msg?.type === "transcript";
      if (text && (isFinal || process.env.SEND_PARTIALS === "1")) {
        // Broadcast to room via data channel
        const payload = new TextEncoder().encode(JSON.stringify({ type: "caption", text, final: !!isFinal }));
        room.localParticipant.publishData(payload, { reliable: false });
      }
    } catch {}
  });
  ws.on("error", (e) => console.warn("Deepgram WS error:", e));
}

async function flushToWhisper(room: Room, ctx: TrackCtx) {
  if (ctx.chunks.length === 0) return;
  const wav = Buffer.concat(ctx.chunks);
  ctx.chunks = [];
  try {
    const fd = new FormData();
    // whisper.cpp HTTP expects a WAV/PCM or common media; we captured webm/opus, so we can just send webm and let server try.
    // If your server demands wav, convert ahead of time (add ffmpeg step). For speed, send webm as-is and rely on server build with ffmpeg.
    fd.append("file", wav, { filename: "audio.webm", contentType: "audio/webm" });
    const res = await fetch(`${whisperUrl}/inference`, { method: "POST", body: fd as any });
    const j = await res.json();
    const text = (j?.result ?? j?.text ?? "").toString().trim();
    if (text) {
      const payload = new TextEncoder().encode(JSON.stringify({ type: "caption", text, final: true, provider: "whisper" }));
      room.localParticipant.publishData(payload, { reliable: true });
    }
  } catch (e) {
    console.warn("Whisper HTTP error:", e);
  }
}

async function main() {
  const r = new Room({ adaptiveStream: false, dynacast: false, stopLocalTrackOnUnpublish: true });
  r.on(RoomEvent.ParticipantConnected, () => {});
  r.on(RoomEvent.ConnectionStateChanged, (s)=>console.log("state:", s));

  const token = await getToken(roomName, identity);
  await r.connect(url, token, { autoSubscribe: true, identity });

  r.on(RoomEvent.TrackSubscribed, async (track, pub, participant) => {
    if (track.kind !== "audio") return;
    const id = `${participant.identity}:${pub.trackSid}`;
    console.log("audio subscribed:", id);
    const ctx: TrackCtx = { id, chunks: [] };
    tracks.set(id, ctx);

    // Create a MediaStream from the RemoteAudioTrack and start a MediaRecorder in Node via wrtc
    const ms = new wrtc.MediaStream();
    // @ts-ignore
    if ((track as any).mediaStreamTrack) {
      // @ts-ignore
      ms.addTrack((track as any).mediaStreamTrack);
    }
    const rec = new (global as any).MediaRecorder(ms as any, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 32000 });
    ctx.recorder = rec;

    // Deepgram realtime
    if (provider === "deepgram" && deepgramKey) {
      await ensureDeepgram(r, ctx);
    }

    rec.ondataavailable = (e: any) => {
      if (!e?.data) return;
      const arr = Buffer.from(new Uint8Array(e.data));
      if (provider === "deepgram" && ctx.dgSocket && ctx.dgSocket.readyState === 1) {
        // Stream raw webm chunks – Deepgram accepts opus in webm
        ctx.dgSocket.send(arr);
      } else {
        // Buffer for Whisper batch
        ctx.chunks.push(arr);
      }
    };
    rec.onstop = async () => {
      if (provider !== "deepgram") await flushToWhisper(r, ctx);
      if (ctx.dgSocket && ctx.dgSocket.readyState === 1) ctx.dgSocket.close();
    };
    rec.start(500); // 500ms chunk cadence
  });

  r.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
    const id = `${participant.identity}:${pub.trackSid}`;
    const ctx = tracks.get(id);
    if (!ctx) return;
    try { ctx.recorder?.stop(); } catch {}
    tracks.delete(id);
  });

  // Keep-alive
  // eslint-disable-next-line no-constant-condition
  while (true) { await sleep(10000); }
}

main().catch((e)=>{ console.error(e); process.exit(1); });