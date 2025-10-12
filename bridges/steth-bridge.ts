/* eslint-disable no-console */
import mqtt from "mqtt";

const BROKER_URL = process.env.MQTT_URL!;
const USER = process.env.MQTT_USERNAME;
const PASS = process.env.MQTT_PASSWORD;
const ROOT = process.env.MQTT_TOPIC_ROOT || "iomt";
const deviceId = process.env.STETH_DEVICE_ID || "Steth-001";

const mq = mqtt.connect(BROKER_URL, { username: USER, password: PASS, keepalive: 30 });
mq.on("connect", () => {
  console.log("[Steth] connected");
  mq.subscribe([`${ROOT}/${deviceId}/cmd/steth.start`, `${ROOT}/${deviceId}/cmd/steth.stop`]);
});

const pub = (path: string, obj: any) =>
  mq.publish(`${ROOT}/${deviceId}/${path}`, JSON.stringify({ ts: Date.now(), ...obj }));

let timer: NodeJS.Timeout | null = null;

mq.on("message", (topic, payload) => {
  if (topic.endsWith("/cmd/steth.start")) {
    // const { mode } = JSON.parse(payload.toString() || "{}");
    if (timer) return;
    const sampleRate = 4000;
    timer = setInterval(() => {
      // mock mono16 audio chunk ~250ms
      const N = Math.floor(sampleRate * 0.25);
      const wav = new Int16Array(N);
      for (let i = 0; i < N; i++) wav[i] = Math.round(Math.sin((Date.now()/1000 + i/sampleRate) * 2*Math.PI*120) * 2000);
      pub("steth/frame", { sampleRate, data: Buffer.from(wav.buffer).toString("base64") });
    }, 250);
  }
  if (topic.endsWith("/cmd/steth.stop")) {
    if (timer) { clearInterval(timer); timer = null; }
    pub("steth/summary", { duration_ms: 5000, peak_db: -12 });
  }
});
