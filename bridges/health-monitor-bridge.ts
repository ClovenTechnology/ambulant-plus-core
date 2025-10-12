/* eslint-disable no-console */
import mqtt from "mqtt";

const BROKER_URL = process.env.MQTT_URL!;
const USER = process.env.MQTT_USERNAME;
the PASS = process.env.MQTT_PASSWORD;
const ROOT = process.env.MQTT_TOPIC_ROOT || "iomt";
const deviceId = process.env.HM_DEVICE_ID || "HealthMonitor-001";

const mq = mqtt.connect(BROKER_URL, { username: USER, password: PASS, keepalive: 30 });
mq.on("connect", () => {
  console.log("[HM] connected");
  mq.subscribe([
    `${ROOT}/${deviceId}/cmd/bp.start`,
    `${ROOT}/${deviceId}/cmd/spo2.start`,
    `${ROOT}/${deviceId}/cmd/glucose.start`,
    `${ROOT}/${deviceId}/cmd/temp.start`,
    `${ROOT}/${deviceId}/cmd/ecg.start`,
    `${ROOT}/${deviceId}/cmd/ecg.stop`,
  ]);
});

const pub = (path: string, obj: any) =>
  mq.publish(`${ROOT}/${deviceId}/${path}`, JSON.stringify({ ts: Date.now(), ...obj }));

// --- mocks until you wire the SDK ---
async function measureBP() {
  const sys = 126, dia = 82, hr = 71;
  const map = Math.round((sys + 2 * dia) / 3);
  pub("sys", { value: sys });
  pub("dia", { value: dia });
  pub("vitals", { hr, map, sys, dia });
}
async function measureSpO2() { pub("spo2", { value: 98 }); pub("hr", { value: 72 }); }
async function measureGlucose() { pub("glucose", { value: 104 }); }
async function measureTemp() { pub("temp", { value: 36.9 }); }

let ecgTimer: NodeJS.Timeout | null = null;
function startEcg() {
  if (ecgTimer) return;
  const sampleRate = 250;
  ecgTimer = setInterval(() => {
    const data = new Int16Array(250);
    for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.sin((Date.now()/1000 + i/250) * 6.28) * 500);
    const buf = Buffer.from(data.buffer);
    pub("ecg/frame", { sampleRate, data: buf.toString("base64") });
  }, 1000);
}
function stopEcg() {
  if (ecgTimer) { clearInterval(ecgTimer); ecgTimer = null; }
  pub("ecg/summary", { tsStart: Date.now()-5000, tsEnd: Date.now(), hrAvg: 72, hrMax: 90, hrMin: 60 });
}
// -------------------------------------

mq.on("message", async (topic) => {
  if (topic.endsWith("/cmd/bp.start")) return void measureBP();
  if (topic.endsWith("/cmd/spo2.start")) return void measureSpO2();
  if (topic.endsWith("/cmd/glucose.start")) return void measureGlucose();
  if (topic.endsWith("/cmd/temp.start")) return void measureTemp();
  if (topic.endsWith("/cmd/ecg.start")) return void startEcg();
  if (topic.endsWith("/cmd/ecg.stop")) return void stopEcg();
});
