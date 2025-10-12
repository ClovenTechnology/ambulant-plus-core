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
  // mirror to RTC (client-side broadcast stub; clinician page listens)
  try {
    const ch = new BroadcastChannel("rtc-iomt");
    ch.postMessage({ type: "cmd", id, cmd, payload, ts: Date.now() });
    ch.close();
  } catch {}
  return res.json().catch(() => ({}));
}

// ---- tiny audio visualiser for steth demo ---------------------------------
function useMicWave(active: boolean) {
  const [ready, setReady] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!active) return;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;
        dataRef.current = new Uint8Array(analyser.frequencyBinCount);
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
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [active]);

  return { analyserRef, dataRef, rafRef, ready };
}

export default function IoMTTabs() {
  const [tab, setTab] = useState<"wearable"|"hm"|"steth"|"oto">("wearable");

  // ---- Health Monitor ------------------------------------------------------
  const [hmBusy, setHmBusy] = useState(false);
  const [hmMsg, setHmMsg] = useState<string | null>(null);
  const hmStart = async (mode: "bp"|"spo2"|"temp"|"hr"|"glucose"|"ecg") => {
    try {
      setHmBusy(true); setHmMsg(null);
      await sendCmd(ids.hm, "hm:start", { mode });
      setHmMsg(`Started ${mode.toUpperCase()}.`);
    } catch (e: any) { setHmMsg(e.message || String(e)); }
    finally { setHmBusy(false); }
  };
  const hmStop = async () => {
    try { setHmBusy(true); setHmMsg(null);
      await sendCmd(ids.hm, "hm:stop");
      setHmMsg("Stopped.");
    } catch (e: any) { setHmMsg(e.message || String(e)); }
    finally { setHmBusy(false); }
  };

  // ---- Stethoscope (device mic demo) --------------------------------------
  const [stMode, setStMode] = useState<"heart"|"lung">("heart");
  const [stUsingMic, setStUsingMic] = useState(true);
  const [stStatus, setStStatus] = useState<"idle"|"recording">("idle");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { analyserRef, dataRef, rafRef, ready } = useMicWave(stStatus === "recording" && stUsingMic);

  useEffect(() => {
    if (!canvasRef.current || !ready) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const render = () => {
      if (!analyserRef.current || !dataRef.current) return;
      analyserRef.current.getByteTimeDomainData(dataRef.current);
      ctx.clearRect(0,0,canvasRef.current!.width, canvasRef.current!.height);
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const buf = dataRef.current;
      for (let i = 0; i < buf.length; i++) {
        const x = (i / (buf.length - 1)) * canvasRef.current!.width;
        const y = (buf[i] / 255) * canvasRef.current!.height;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ready]);

  const stStart = async () => {
    try {
      setStStatus("recording");
      await sendCmd(ids.steth, "steth:start", { mode: stMode, source: stUsingMic ? "device-mic" : "hardware" });
    } catch (e) {
      // still allow local mic demo to run; log only
      console.error(e);
    }
  };
  const stStop = async () => {
    try {
      setStStatus("idle");
      await sendCmd(ids.steth, "steth:stop");
    } catch (e) { console.error(e); }
  };

  // ---- Otoscope (device camera demo) --------------------------------------
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [otoOn, setOtoOn] = useState(false);
  const startOto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setOtoOn(true);
      await sendCmd(ids.oto, "oto:start", { source: "device-camera" });
    } catch (e: any) { alert(e.message || String(e)); }
  };
  const stopOto = async () => {
    try {
      const v = videoRef.current;
      (v?.srcObject as MediaStream | null)?.getTracks().forEach(t => t.stop());
      if (v) v.srcObject = null;
      setOtoOn(false);
      await sendCmd(ids.oto, "oto:stop");
    } catch (e) { console.error(e); }
  };

  // ---- pair/connect demo states (toggle) -----------------------------------
  const [paired] = useState({ hm: true, st: true, oto: true });
  const [connected, setConnected] = useState({ hm: false, st: false, oto: false });
  const toggleConnect = (k: "hm"|"st"|"oto") =>
    setConnected(prev => ({ ...prev, [k]: !prev[k] }));

  // ---- UI helpers ----------------------------------------------------------
  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-full text-sm border ${tab === id
        ? "bg-emerald-500 text-white border-emerald-500"
        : "bg-white dark:bg-slate-900/70 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200"}`}
    >
      {label}
    </button>
  );

  const Pane = ({ children }: { children: any }) => (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-4 mt-3">{children}</div>
  );

  // ---- Render --------------------------------------------------------------
  return (
    <section className="mt-2">
      <div className="flex flex-wrap gap-2">
        <TabBtn id="wearable" label="Wearable" />
        <TabBtn id="hm"       label="Health Monitor" />
        <TabBtn id="steth"    label="Digital Stethoscope" />
        <TabBtn id="oto"      label="HD Otoscope" />
      </div>

      {/* Wearable */}
      {tab === "wearable" && (
        <Pane>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-700 dark:text-slate-300">
              Device ID: <span className="font-semibold">{ids.wearable}</span> (continuous stream)
            </div>
            <BatteryIcon level={78}/>
          </div>
          <div className="mt-3 text-slate-600 dark:text-slate-300 text-sm">
            Steps, calories, distance & sleep (SSE topics: <code>steps</code>, <code>calories</code>, <code>distance</code>, <code>sleep</code>) will render in tiles/charts.
          </div>
        </Pane>
      )}

      {/* Health Monitor */}
      {tab === "hm" && (
        <Pane>
          <div className="flex items-center justify-between">
            <div className="text-sm">Device ID: <span className="font-semibold">{ids.hm}</span></div>
            <div className="flex items-center gap-3">
              <BatteryIcon level={63}/>
              <button onClick={() => toggleConnect("hm")}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${connected.hm ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                {connected.hm ? "Disconnect" : "Connect"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              {k:"bp",       label:"Blood Pressure"},
              {k:"spo2",     label:"Blood Oxygen"},
              {k:"temp",     label:"Body Temperature"},
              {k:"hr",       label:"Heart Rate"},
              {k:"glucose",  label:"Blood Glucose"},
              {k:"ecg",      label:"ECG / EKG"},
            ].map(({k,label}) => (
              <button key={k}
                onClick={() => hmStart(k as any)}
                disabled={hmBusy || !connected.hm}
                className="h-20 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
              >{label}</button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button onClick={hmStop} disabled={hmBusy || !connected.hm} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm">Stop</button>
            {hmMsg ? <span className="text-sm text-slate-600 dark:text-slate-300">{hmMsg}</span> : null}
          </div>
        </Pane>
      )}

      {/* Digital Stethoscope */}
      {tab === "steth" && (
        <Pane>
          <div className="flex items-center justify-between">
            <div className="text-sm">Device ID: <span className="font-semibold">{ids.steth}</span></div>
            <div className="flex items-center gap-3">
              <BatteryIcon level={56}/>
              <button onClick={() => toggleConnect("st")}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${connected.st ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                {connected.st ? "Disconnect" : "Connect"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 dark:border-white/10">
              {(["heart","lung"] as const).map(m => (
                <button key={m} onClick={() => setStMode(m)}
                  className={`px-3 py-1.5 text-sm ${stMode===m ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900/70"}`}>
                  {m === "heart" ? "Heart" : "Lung"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={stUsingMic} onChange={e => setStUsingMic(e.target.checked)} />
              Use this device microphone (demo)
            </label>
          </div>

          <div className="mt-3">
            <canvas ref={canvasRef} className="w-full h-36 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10" width={800} height={160} />
          </div>

          <div className="mt-3 flex gap-2">
            {stStatus === "recording" ? (
              <button onClick={stStop} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm">Stop</button>
            ) : (
              <button onClick={stStart} disabled={!connected.st} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm">Start</button>
            )}
          </div>
        </Pane>
      )}

      {/* HD Otoscope */}
      {tab === "oto" && (
        <Pane>
          <div className="flex items-center justify-between">
            <div className="text-sm">Device ID: <span className="font-semibold">{ids.oto}</span></div>
            <div className="flex items-center gap-3">
              <BatteryIcon level={71}/>
              <button onClick={() => toggleConnect("oto")}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${connected.oto ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                {connected.oto ? "Disconnect" : "Connect"}
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-black">
              <video ref={videoRef} className="w-full h-60 object-contain" autoPlay playsInline muted />
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-sm text-slate-600 dark:text-slate-300">Use your device camera for preview. When hardware is connected this is overridden automatically.</div>
              <div className="flex gap-2">
                {!otoOn ? (
                  <button onClick={startOto} disabled={!connected.oto} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm">Start</button>
                ) : (
                  <button onClick={stopOto} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm">Stop</button>
                )}
              </div>
            </div>
          </div>
        </Pane>
      )}
    </section>
  );
}
