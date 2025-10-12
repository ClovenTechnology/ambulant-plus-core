"use client";
import { Room } from "livekit-client";

type StartOpts = { key?: string; model?: string; language?: string; interim?: boolean };

// Try Deepgram realtime via token in query (browsers can't set WS headers)
async function tryDeepgram(room: Room, key: string, model: string, language: string, interim: boolean, stream: MediaStream) {
  const qs = new URLSearchParams({
    model, language,
    smart_format: "true",
    interim_results: interim ? "true" : "false",
    punctuate: "true",
    diarize: "false",
    token: key,
  });
  const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${qs.toString()}`);

  const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 32000 });
  const sendChunk = async (b: Blob) => { if (ws.readyState === 1) ws.send(await b.arrayBuffer()); };

  ws.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      const alt = msg?.channel?.alternatives?.[0];
      const text = (alt?.transcript ?? "").trim();
      const isFinal = msg?.is_final === true || msg?.type === "transcript";
      if (text) {
        const payload = new TextEncoder().encode(JSON.stringify({ type: "caption", text, final: !!isFinal, from: "client" }));
        room.localParticipant.publishData(payload, { reliable: !interim || isFinal });
      }
    } catch {}
  });

  const start = new Promise<void>((resolve, reject) => {
    let opened = false;
    ws.addEventListener("open", () => { opened = true; rec.start(250); resolve(); }, { once: true });
    ws.addEventListener("error", () => !opened && reject(new Error("DG WS failed")), { once: true });
    ws.addEventListener("close", () => !opened && reject(new Error("DG WS closed before open")), { once: true });
  });

  const stop = () => {
    try { rec.state !== "inactive" && rec.stop(); } catch {}
    try { ws.readyState === 1 && ws.close(); } catch {}
  };
  rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) sendChunk(e.data); };

  await start; // throws if failed to open
  return stop;
}

// Web Speech API fallback (Chrome/Edge)
function tryWebSpeech(room: Room, interim: boolean) {
  // @ts-ignore
  const SR = (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!SR) throw new Error("Web Speech not available");
  const sr = new SR();
  sr.continuous = true;
  sr.interimResults = interim;
  sr.lang = (process.env.NEXT_PUBLIC_DEEPGRAM_LANGUAGE || "en").toString();

  sr.onresult = (e: SpeechRecognitionEvent) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const text = res[0]?.transcript?.trim();
      if (!text) continue;
      const payload = new TextEncoder().encode(JSON.stringify({ type: "caption", text, final: res.isFinal, from: "webspeech" }));
      room.localParticipant.publishData(payload, { reliable: !interim || res.isFinal });
    }
  };
  sr.start();

  const stop = () => { try { sr.stop(); } catch {} };
  return stop;
}

export async function startClientCaptioner(room: Room, opts: StartOpts) {
  const key = (opts.key || (process.env.NEXT_PUBLIC_DEEPGRAM_KEY as any) || "").toString();
  const model = (opts.model || (process.env.NEXT_PUBLIC_DEEPGRAM_MODEL as any) || "nova-2-general").toString();
  const language = (opts.language || (process.env.NEXT_PUBLIC_DEEPGRAM_LANGUAGE as any) || "en").toString();
  const interim = opts.interim ?? true;

  // mic stream is needed for both paths
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

  // prefer Deepgram if we have a key
  if (key) {
    try {
      const stopDG = await tryDeepgram(room, key, model, language, interim, stream);
      return () => { try { stopDG(); } catch {} stream.getTracks().forEach(t => t.stop()); };
    } catch (e) {
      console.warn("Deepgram failed, falling back to Web Speech:", e);
    }
  }

  // fallback
  try {
    const stopWS = tryWebSpeech(room, interim);
    return () => { try { stopWS(); } catch {} stream.getTracks().forEach(t => t.stop()); };
  } catch (e) {
    console.warn("Web Speech unavailable:", e);
    // cleanup mic if nothing started
    stream.getTracks().forEach(t => t.stop());
    throw e;
  }
}