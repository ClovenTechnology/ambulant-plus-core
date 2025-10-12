/* eslint-disable no-console */
const mqtt = require("mqtt");

const URL  = process.env.MQTT_URL;
const USER = process.env.MQTT_USERNAME;
const PASS = process.env.MQTT_PASSWORD;
const ROOT = process.env.MQTT_TOPIC_ROOT || "iomt";
const ID   = process.env.OTO_DEVICE_ID || "DueOto";

if (!URL) throw new Error("MQTT_URL missing");

const c = mqtt.connect(URL, { username: USER, password: PASS, keepalive: 30 });
c.on("connect", () => {
  console.log("[Oto] connected", URL, "id:", ID);
  c.subscribe(`${ROOT}/${ID}/cmd/#`);
});

let vTimer = null;
let vIdx = 0;

c.on("message", (topic, buf) => {
  const tail = topic.split("/").slice(3).join("/");

  if (tail === "otoscope.photo") {
    const png1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
    c.publish(`${ROOT}/${ID}/otoscope/photo`, JSON.stringify({ ts: Date.now(), mime: "image/png", data: png1x1, width: 1, height: 1 }));
  }

  if (tail === "otoscope.video.start") {
    if (vTimer) return;
    vIdx = 0;
    vTimer = setInterval(() => {
      const chunk = Buffer.from(`chunk-${vIdx++}`).toString("base64");
      c.publish(`${ROOT}/${ID}/otoscope/video/part`, JSON.stringify({ ts: Date.now(), idx: vIdx, mime: "video/mp4", data: chunk }));
    }, 400);
  }

  if (tail === "otoscope.video.stop") {
    if (!vTimer) return;
    clearInterval(vTimer);
    vTimer = null;
    c.publish(`${ROOT}/${ID}/otoscope/video/done`, JSON.stringify({ ts: Date.now(), parts: vIdx, url: "" }));
  }
});
