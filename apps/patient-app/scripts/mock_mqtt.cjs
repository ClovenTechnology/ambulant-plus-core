const mqtt = require("mqtt");
const URL   = process.env.MQTT_URL || "wss://broker.emqx.io:8084/mqtt";
const USER  = process.env.MQTT_USERNAME || undefined;
const PASS  = process.env.MQTT_PASSWORD || undefined;
const ROOT  = process.env.MQTT_TOPIC_ROOT || "iomt";
const DEV   = process.argv[2] || "demo-001";
const c = mqtt.connect(URL, { username: USER, password: PASS, keepalive: 30 });
c.on("connect", () => {
  console.log("[mock] connected to", URL, "publishing under", `${ROOT}/${DEV}/#`);
  setInterval(() => pub("hr",    65 + Math.round(Math.random()*10)), 1000);
  setInterval(() => pub("spo2",  96 + Math.round(Math.random()*3)),  1100);
  setInterval(() => { const sys=110+Math.round(Math.random()*20); const dia=70+Math.round(Math.random()*10); pub("sys",sys); pub("dia",dia); }, 1500);
  setInterval(() => pub("rr",    12 + Math.round(Math.random()*6)),  1600);
  setInterval(() => pub("temp",  36.5 + Math.random()*0.6),          2500);
  setInterval(() => pub("glucose", 90 + Math.round(Math.random()*40)), 3000);
});
function pub(metric, value) {
  const topic = `${ROOT}/${DEV}/${metric}`;
  const payload = JSON.stringify({ value, ts: Date.now() });
  c.publish(topic, payload);
}
