"use client";

import { Room } from "livekit-client";

type StartOpts = {
  key?: string;
  model?: string;
  language?: string;
  interim?: boolean;
};

function publishBrowserCaption(room: Room, text: string, final: boolean) {
  const payload = new TextEncoder().encode(
    JSON.stringify({
      type: "caption",
      text,
      final,
      from: "webspeech",
      source: "browser-web-speech",
    }),
  );

  room.localParticipant.publishData(payload, {
    reliable: final,
    topic: "captions",
  });
}

/**
 * Legacy client captioner retained only as a non-secret browser fallback.
 *
 * Production captions must come from the server-side caption-worker using
 * AWS Transcribe Medical. This function deliberately does not read
 * NEXT_PUBLIC_DEEPGRAM_KEY or any browser-exposed STT key.
 */
export async function startClientCaptioner(room: Room, opts: StartOpts = {}) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Client-side captioning is disabled in production. Use the server-side caption-worker.",
    );
  }

  // @ts-ignore - browser vendor API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    throw new Error("Web Speech is not available in this browser.");
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = opts.interim ?? true;
  recognition.lang = opts.language || "en-US";

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result?.[0]?.transcript?.trim();
      if (!text) continue;
      publishBrowserCaption(room, text, !!result.isFinal);
    }
  };

  recognition.start();

  return () => {
    try {
      recognition.stop();
    } catch {
      // ignore
    }
  };
}
