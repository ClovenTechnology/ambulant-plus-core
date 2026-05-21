// apps/patient-app/components/iomt/IoMTTabs.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import BatteryIcon from "./BatteryIcon";

// ---- device ids ------------------------------------------------------------
const ids = {
  wearable: "NexRing",
  hm: "DueMonitor",
  steth: "DueScope",
  oto: "DueOto",
} as const;

// ---- API helper ------------------------------------------------------------
async function sendCmd(id: string, cmd: string, payload?: any) {
  if (!id || !cmd) throw new Error("Device id & cmd required");

  const res = await fetch("/api/iomt/cmd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, cmd, payload }),
  });

  if (!res.ok) throw new Error(await res.text());

  try {
    const ch = new BroadcastChannel("rtc-iomt");
    ch.postMessage({ type: "cmd", id, cmd, payload, ts: Date.now() });
    ch.close();
  } catch {
    // BroadcastChannel may be unavailable in restricted browsers.
  }

  return res.json().catch(() => ({}));
}

// ---- tiny audio visualiser for stethoscope ---------------------------------
function useMicWave(active: boolean) {
  const [ready, setReady] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    if (!active) return;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const AudioContextCtor =
          window.AudioContext || (window as any).webkitAudioContext;

        const ctx = new AudioContextCtor() as AudioContext;
        audioCtxRef.current = ctx;

        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();

        analyser.fftSize = 256;
        src.connect(analyser);

        analyserRef.current = analyser;
        dataRef.current = new Uint8Array(
          new ArrayBuffer(analyser.frequencyBinCount),
        );

        setReady(true);
      } catch (e) {
        console.error(e);
        setReady(false);
      }
    })();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      analyserRef.current = null;
      dataRef.current = null;

      stream?.getTracks().forEach((t) => t.stop());

      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;

      void ctx?.close().catch(() => undefined);

      setReady(false);
    };
  }, [active]);

  return { analyserRef, dataRef, rafRef, ready };
}

export default function IoMTTabs() {
  const [tab, setTab] = useState<"wearable" | "hm" | "steth" | "oto">(
    "wearable",
  );

  // ---- Health Monitor ------------------------------------------------------
  const [hmBusy, setHmBusy] = useState(false);
  const [hmMsg, setHmMsg] = useState<string | null>(null);

  const hmStart = async (
    mode: "bp" | "spo2" | "temp" | "hr" | "glucose" | "ecg",
  ) => {
    try {
      setHmBusy(true);
      setHmMsg(null);
      await sendCmd(ids.hm, "hm:start", { mode });
      setHmMsg(`Started ${mode.toUpperCase()}.`);
    } catch (e: any) {
      setHmMsg(e.message || String(e));
    } finally {
      setHmBusy(false);
    }
  };

  const hmStop = async () => {
    try {
      setHmBusy(true);
      setHmMsg(null);
      await sendCmd(ids.hm, "hm:stop");
      setHmMsg("Stopped.");
    } catch (e: any) {
      setHmMsg(e.message || String(e));
    } finally {
      setHmBusy(false);
    }
  };

  // ---- Stethoscope ---------------------------------------------------------
  const [stMode, setStMode] = useState<"heart" | "lung">("heart");
  const [stUsingMic, setStUsingMic] = useState(true);
  const [stStatus, setStStatus] = useState<"idle" | "recording">("idle");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { analyserRef, dataRef, rafRef, ready } = useMicWave(
    stStatus === "recording" && stUsingMic,
  );

  useEffect(() => {
    if (!canvasRef.current || !ready) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      if (!analyserRef.current || !dataRef.current || !canvasRef.current) {
        return;
      }

      analyserRef.current.getByteTimeDomainData(dataRef.current);

      const activeCanvas = canvasRef.current;
      ctx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 2;
      ctx.beginPath();

      const buf = dataRef.current;

      for (let i = 0; i < buf.length; i++) {
        const x = (i / Math.max(1, buf.length - 1)) * activeCanvas.width;
        const y = (buf[i] / 255) * activeCanvas.height;

        if (i) {
          ctx.lineTo(x, y);
        } else {
          ctx.moveTo(x, y);
        }
      }

      ctx.stroke();
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserRef, dataRef, rafRef, ready]);

  const stStart = async () => {
    try {
      setStStatus("recording");
      await sendCmd(ids.steth, "steth:start", {
        mode: stMode,
        source: stUsingMic ? "device-mic" : "hardware",
      });
    } catch (e) {
      console.error(e);
    }
  };

  const stStop = async () => {
    try {
      setStStatus("idle");
      await sendCmd(ids.steth, "steth:stop");
    } catch (e) {
      console.error(e);
    }
  };

  // ---- Otoscope ------------------------------------------------------------
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [otoOn, setOtoOn] = useState(false);

  const startOto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      if (videoRef.current) videoRef.current.srcObject = stream;

      setOtoOn(true);
      await sendCmd(ids.oto, "oto:start", { source: "device-camera" });
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };

  const stopOto = async () => {
    try {
      const v = videoRef.current;
      (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());

      if (v) v.srcObject = null;

      setOtoOn(false);
      await sendCmd(ids.oto, "oto:stop");
    } catch (e) {
      console.error(e);
    }
  };

  // ---- pair/connect states -------------------------------------------------
  const [connected, setConnected] = useState({
    hm: false,
    st: false,
    oto: false,
  });

  const toggleConnect = (k: "hm" | "st" | "oto") =>
    setConnected((prev) => ({ ...prev, [k]: !prev[k] }));

  // ---- UI helpers ----------------------------------------------------------
  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-full border px-4 py-2 text-sm ${
        tab === id
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200"
      }`}
    >
      {label}
    </button>
  );

  const Pane = ({ children }: { children: React.ReactNode }) => (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/60">
      {children}
    </div>
  );

  return (
    <section className="mt-2">
      <div className="flex flex-wrap gap-2">
        <TabBtn id="wearable" label="Wearable" />
        <TabBtn id="hm" label="Health Monitor" />
        <TabBtn id="steth" label="Digital Stethoscope" />
        <TabBtn id="oto" label="HD Otoscope" />
      </div>

      {tab === "wearable" && (
        <Pane>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-700 dark:text-slate-300">
              Device ID: <span className="font-semibold">{ids.wearable}</span>{" "}
              continuous stream
            </div>
            <BatteryIcon level={78} />
          </div>

          <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Steps, calories, distance and sleep data render through the wearable
            stream.
          </div>
        </Pane>
      )}

      {tab === "hm" && (
        <Pane>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              Device ID: <span className="font-semibold">{ids.hm}</span>
            </div>

            <div className="flex items-center gap-3">
              <BatteryIcon level={63} />
              <button
                type="button"
                onClick={() => toggleConnect("hm")}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  connected.hm
                    ? "border-rose-200 bg-rose-100 text-rose-700"
                    : "border-emerald-200 bg-emerald-100 text-emerald-700"
                }`}
              >
                {connected.hm ? "Disconnect" : "Connect"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {[
              { k: "bp", label: "Blood Pressure" },
              { k: "spo2", label: "Blood Oxygen" },
              { k: "temp", label: "Body Temperature" },
              { k: "hr", label: "Heart Rate" },
              { k: "glucose", label: "Blood Glucose" },
              { k: "ecg", label: "ECG / EKG" },
            ].map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => hmStart(k as Parameters<typeof hmStart>[0])}
                disabled={hmBusy || !connected.hm}
                className="h-20 rounded-xl border border-slate-200 bg-slate-50 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-900/50 dark:hover:bg-slate-800"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={hmStop}
              disabled={hmBusy || !connected.hm}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900"
            >
              Stop
            </button>

            {hmMsg ? (
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {hmMsg}
              </span>
            ) : null}
          </div>
        </Pane>
      )}

      {tab === "steth" && (
        <Pane>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              Device ID: <span className="font-semibold">{ids.steth}</span>
            </div>

            <div className="flex items-center gap-3">
              <BatteryIcon level={56} />
              <button
                type="button"
                onClick={() => toggleConnect("st")}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  connected.st
                    ? "border-rose-200 bg-rose-100 text-rose-700"
                    : "border-emerald-200 bg-emerald-100 text-emerald-700"
                }`}
              >
                {connected.st ? "Disconnect" : "Connect"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
              {(["heart", "lung"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setStMode(m)}
                  className={`px-3 py-1.5 text-sm ${
                    stMode === m
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-white dark:bg-slate-900/70"
                  }`}
                >
                  {m === "heart" ? "Heart" : "Lung"}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stUsingMic}
                onChange={(e) => setStUsingMic(e.target.checked)}
              />
              Use this device microphone
            </label>
          </div>

          <div className="mt-3">
            <canvas
              ref={canvasRef}
              className="h-36 w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900/50"
              width={800}
              height={160}
            />
          </div>

          <div className="mt-3 flex gap-2">
            {stStatus === "recording" ? (
              <button
                type="button"
                onClick={stStop}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={stStart}
                disabled={!connected.st}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start
              </button>
            )}
          </div>
        </Pane>
      )}

      {tab === "oto" && (
        <Pane>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              Device ID: <span className="font-semibold">{ids.oto}</span>
            </div>

            <div className="flex items-center gap-3">
              <BatteryIcon level={71} />
              <button
                type="button"
                onClick={() => toggleConnect("oto")}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  connected.oto
                    ? "border-rose-200 bg-rose-100 text-rose-700"
                    : "border-emerald-200 bg-emerald-100 text-emerald-700"
                }`}
              >
                {connected.oto ? "Disconnect" : "Connect"}
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-black dark:border-white/10">
              <video
                ref={videoRef}
                className="h-60 w-full object-contain"
                autoPlay
                playsInline
                muted
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Use camera preview when otoscope hardware is not actively
                streaming.
              </div>

              <div className="flex gap-2">
                {!otoOn ? (
                  <button
                    type="button"
                    onClick={startOto}
                    disabled={!connected.oto}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Start
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopOto}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
          </div>
        </Pane>
      )}
    </section>
  );
}