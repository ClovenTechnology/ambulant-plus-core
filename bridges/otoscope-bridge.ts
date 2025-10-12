/* eslint-disable no-console */
import mqtt from "mqtt";

const BROKER_URL = process.env.MQTT_URL!;
const USER = process.env.MQTT_USERNAME;
const PASS = process.env.MQTT_PASSWORD;
const ROOT = process.env.MQTT_TOPIC_ROOT || "iomt";
const deviceId = process.env.OTO_DEVICE_ID || "Otoscope-001";

const mq = mqtt.connect(BROKER_URL, { username: USER, password: PASS, keepalive: 30 });
mq.on("connect", () => {
  console.log("[Oto] connected");
  mq.subscribe([
    `${ROOT}/${deviceId}/cmd/otoscope.photo`,
    `${ROOT}/${deviceId}/cmd/otoscope.video.start`,
    `${ROOT}/${deviceId}/cmd/otoscope.video.stop`,
  ]);
});

const pub = (path: string, obj: any) =>
  mq.publish(`${ROOT}/${deviceId}/${path}`, JSON.stringify({ ts: Date.now(), ...obj }));

let videoTimer: NodeJS.Timeout | null = null;
let idx = 0;

mq.on("message", (topic) => {
  if (topic.endsWith("/cmd/otoscope.photo")) {
    // mock: publish a tiny base64 jpeg placeholder
    const jpeg = Buffer.from("FFD8FFE0", "hex").toString("base64");
    pub("otoscope/photo", { mime: "image/jpeg", data: jpeg });
  }
  if (topic.endsWith("/cmd/otoscope.video.start")) {
    if (videoTimer) return;
    videoTimer = setInterval(() => {
      const chunk = Buffer.from(`chunk-${++idx}`).toString("base64");
      pub("otoscope/video/part", { idx, mime: "video/mp4", data: chunk });
    }, 300);
  }
  if (topic.endsWith("/cmd/otoscope.video.stop")) {
    if (videoTimer) { clearInterval(videoTimer); videoTimer = null; }
    pub("otoscope/video/done", { url: "https://example.com/video.mp4", parts: idx });
    idx = 0;
  }
});
