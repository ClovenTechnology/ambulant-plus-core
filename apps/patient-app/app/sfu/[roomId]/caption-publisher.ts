// apps/patient-app/app/sfu/[roomId]/caption-publisher.ts
'use client';

import { Room } from 'livekit-client';

type StartOpts = {
  /**
   * Optional short-lived Deepgram token.
   *
   * Do not pass a long-lived provider API key to the browser.
   * If omitted, the captioner falls back to the browser Web Speech API.
   */
  key?: string;
  model?: string;
  language?: string;
  interim?: boolean;
};

type StopFn = () => void;

type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: {
    transcript?: string;
  };
};

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: BrowserSpeechRecognitionResult;
  };
};

type BrowserSpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function publishCaption(
  room: Room,
  payload: {
    text: string;
    final: boolean;
    from: 'deepgram' | 'webspeech';
  },
  reliable: boolean,
) {
  const text = payload.text.trim();
  if (!text) return;

  const encoded = new TextEncoder().encode(
    JSON.stringify({
      type: 'caption',
      text,
      final: payload.final,
      from: payload.from,
      ts: new Date().toISOString(),
    }),
  );

  room.localParticipant.publishData(encoded, { reliable });
}

function getSpeechRecognitionConstructor():
  | BrowserSpeechRecognitionConstructor
  | null {
  if (typeof window === 'undefined') return null;

  const w = window as unknown as {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function preferredMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

async function tryDeepgram(
  room: Room,
  token: string,
  model: string,
  language: string,
  interim: boolean,
  stream: MediaStream,
): Promise<StopFn> {
  if (!token.trim()) {
    throw new Error('deepgram_token_required');
  }

  if (typeof WebSocket === 'undefined') {
    throw new Error('websocket_unavailable');
  }

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('media_recorder_unavailable');
  }

  const qs = new URLSearchParams({
    model,
    language,
    smart_format: 'true',
    interim_results: interim ? 'true' : 'false',
    punctuate: 'true',
    diarize: 'false',

    /**
     * Browser WebSocket cannot set Authorization headers reliably.
     * This must be a short-lived token, not a long-lived provider API key.
     */
    token,
  });

  const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${qs.toString()}`);

  const mimeType = preferredMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType
      ? {
          mimeType,
          audioBitsPerSecond: 32_000,
        }
      : {
          audioBitsPerSecond: 32_000,
        },
  );

  let stopped = false;

  async function sendChunk(blob: Blob) {
    if (stopped || !blob.size || ws.readyState !== WebSocket.OPEN) return;

    try {
      ws.send(await blob.arrayBuffer());
    } catch {
      // Non-fatal: the close/error listeners handle stream shutdown.
    }
  }

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      void sendChunk(event.data);
    }
  };

  ws.addEventListener('message', (event) => {
    try {
      if (typeof event.data !== 'string') return;

      const msg = JSON.parse(event.data);
      const alt = msg?.channel?.alternatives?.[0];
      const text = String(alt?.transcript ?? '').trim();

      if (!text) return;

      const isFinal =
        msg?.is_final === true ||
        msg?.speech_final === true ||
        msg?.type === 'transcript';

      publishCaption(
        room,
        {
          text,
          final: Boolean(isFinal),
          from: 'deepgram',
        },
        !interim || Boolean(isFinal),
      );
    } catch {
      // Ignore malformed provider messages.
    }
  });

  await new Promise<void>((resolve, reject) => {
    let opened = false;

    ws.addEventListener(
      'open',
      () => {
        opened = true;
        recorder.start(250);
        resolve();
      },
      { once: true },
    );

    ws.addEventListener(
      'error',
      () => {
        if (!opened) reject(new Error('deepgram_websocket_failed'));
      },
      { once: true },
    );

    ws.addEventListener(
      'close',
      () => {
        if (!opened) reject(new Error('deepgram_websocket_closed_before_open'));
      },
      { once: true },
    );
  });

  return () => {
    stopped = true;

    try {
      if (recorder.state !== 'inactive') recorder.stop();
    } catch {}

    try {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    } catch {}
  };
}

function tryWebSpeech(
  room: Room,
  interim: boolean,
  language: string,
): StopFn {
  const SpeechRecognitionCtor = getSpeechRecognitionConstructor();

  if (!SpeechRecognitionCtor) {
    throw new Error('web_speech_unavailable');
  }

  const recognition = new SpeechRecognitionCtor();

  recognition.continuous = true;
  recognition.interimResults = interim;
  recognition.lang = language;

  recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result?.[0]?.transcript?.trim();

      if (!text) continue;

      publishCaption(
        room,
        {
          text,
          final: Boolean(result.isFinal),
          from: 'webspeech',
        },
        !interim || Boolean(result.isFinal),
      );
    }
  };

  recognition.onerror = () => {
    // Browser speech errors are surfaced by the caller through UI state/logging.
  };

  recognition.start();

  return () => {
    try {
      recognition.stop();
    } catch {}
  };
}

export async function startClientCaptioner(
  room: Room,
  opts: StartOpts = {},
): Promise<StopFn> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('microphone_capture_unavailable');
  }

  const token = String(opts.key || '').trim();
  const model = String(opts.model || 'nova-2-general').trim();
  const language = String(opts.language || 'en').trim();
  const interim = opts.interim ?? true;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });

  if (token) {
    try {
      const stopDeepgram = await tryDeepgram(
        room,
        token,
        model,
        language,
        interim,
        stream,
      );

      return () => {
        try {
          stopDeepgram();
        } catch {}

        stream.getTracks().forEach((track) => track.stop());
      };
    } catch (error) {
      console.warn('Deepgram captioning failed; falling back to Web Speech:', error);
    }
  }

  try {
    const stopWebSpeech = tryWebSpeech(room, interim, language);

    return () => {
      try {
        stopWebSpeech();
      } catch {}

      stream.getTracks().forEach((track) => track.stop());
    };
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    console.warn('Client captioning unavailable:', error);
    throw error;
  }
}