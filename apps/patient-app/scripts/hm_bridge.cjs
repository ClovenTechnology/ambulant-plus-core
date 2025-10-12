/* eslint-disable no-console */
const mqtt = require("mqtt");

const URL  = process.env.MQTT_URL;
const USER = process.env.MQTT_USERNAME;
const PASS = process.env.MQTT_PASSWORD;
const ROOT = process.env.MQTT_TOPIC_ROOT || "iomt";
const ID   = process.env.HM_DEVICE_ID || "DueMonitor";

if (!URL) throw new Error("MQTT_URL missing");

const c = mqtt.connect(URL, { username: USER, password: PASS, keepalive: 30 });
c.on("connect", () => {
  console.log("[HM] connected", URL, "id:", ID);
  c.subscribe(`${ROOT}/${ID}/cmd/#`);
});

function pub(metric, value, extra = {}) {
  const payload = JSON.stringify({ ts: Date.now(), value, ...extra });
  c.publish(`${ROOT}/${ID}/${metric}`, payload);
}

let ecgTimer = null;
let ecgStart = 0;

c.on("message", (topic, buf) => {
  const tail = topic.split("/").slice(3).join("/");
  let payload = {};
  try { payload = JSON.parse(buf.toString()); } catch {}

  if (tail === "bp.start") {
    const sys = 110 + Math.round(Math.random() * 30);
    const dia = 70 + Math.round(Math.random() * 15);
    const hr  = 60 + Math.round(Math.random() * 15);
    const map = Math.round((sys + 2 * dia) / 3);
    pub("sys", sys);
    pub("dia", dia);
    pub("map", map);
    pub("hr", hr);
    c.publish(`${ROOT}/${ID}/vitals`, JSON.stringify({ ts: Date.now(), sys, dia, map, hr }));
  }

  if (tail === "spo2.start") {
    const spo2 = 95 + Math.round(Math.random() * 5);
    const hr   = 60 + Math.round(Math.random() * 10);
    pub("spo2", spo2, { hr });
    pub("hr", hr);
  }

  if (tail === "temp.start") {
    const t = 36.4 + Math.random() * 0.8;
    pub("temp", Math.round(t * 100) / 100);
  }

  if (tail === "glucose.start") {
    const g = 80 + Math.round(Math.random() * 60);
    pub("glucose", g);
  }

  if (tail === "ecg.start") {
    if (ecgTimer) return;
    ecgStart = Date.now();
    let phase = 0;
    ecgTimer = setInterval(() => {
      const sampleRate = 250;
      const n = 250; // 1s
      const arr = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        phase += 0.08;
        arr[i] = Math.round(800 * Math.sin(phase) + (Math.random() - 0.5) * 150);
      }
      const data = Buffer.from(arr.buffer).toString("base64");
      c.publish(`${ROOT}/${ID}/ecg/frame`, JSON.stringify({ ts: Date.now(), sampleRate, data }));
    }, 1000);
  }

  if (tail === "ecg.stop") {
    if (!ecgTimer) return;
    clearInterval(ecgTimer);
    ecgTimer = null;
    c.publish(`${ROOT}/${ID}/ecg/summary`, JSON.stringify({
      tsStart: ecgStart, tsEnd: Date.now(), hrAvg: 72, hrMax: 96, hrMin: 58
    }));
  }
});
