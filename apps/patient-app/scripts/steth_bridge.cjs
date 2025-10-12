/* eslint-disable no-console */
const mqtt = require("mqtt");

const URL  = process.env.MQTT_URL;
const USER = process.env.MQTT_USERNAME;
const PASS = process.env.MQTT_PASSWORD;
const ROOT = process.env.MQTT_TOPIC_ROOT || "iomt";
const ID   = process.env.STETH_DEVICE_ID || "DueScope";

if (!URL) throw new Error("MQTT_URL missing");

const c = mqtt.connect(URL, { username: USER, password: PASS, keepalive: 30 });
c.on("connect", () => {
  console.log("[Steth] connected", URL, "id:", ID);
  c.subscribe(`${ROOT}/${ID}/cmd/#`);
});

let timer = null;
let started = 0;

c.on("message", (topic, buf) => {
  const tail = topic.split("/").slice(3).join("/");
  let payload = {};
  try { payload = JSON.parse(buf.toString()); } catch {}

  if (tail === "steth.start") {
    if (timer) return;
    started = Date.now();
    let t = 0;
    timer = setInterval(() => {
      const sampleRate = 4000;
      const samples = 1000;
      const arr = new Int16Array(samples);
      const freq = payload.mode === "lung" ? 180 : 60;
      for (let i = 0; i < samples; i++) {
        t += 1;
        const s = Math.sin((2 * Math.PI * freq * (t / sampleRate))) + (Math.random() - 0.5) * 0.1;
        arr[i] = Math.max(-32768, Math.min(32767, Math.round(s * 5000)));
      }
      const data = Buffer.from(arr.buffer).toString("base64");
      c.publish(`${ROOT}/${ID}/steth/frame`, JSON.stringify({ ts: Date.now(), sampleRate, data, mode: payload.mode || "heart" }));
    }, 300);
  }

  if (tail === "steth.stop") {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    const duration_ms = Date.now() - started;
    c.publish(`${ROOT}/${ID}/steth/summary`, JSON.stringify({ duration_ms, peak_db: -12.4 }));
  }
});
