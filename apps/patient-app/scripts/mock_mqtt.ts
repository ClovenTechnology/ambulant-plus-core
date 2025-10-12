import mqtt from "mqtt";
const url = process.env.MQTT_URL || "mqtt://localhost:1883";
const client = mqtt.connect(url, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  protocolVersion: 5,
});
const dev = "demo-001";
client.on("connect", () => {
  console.log("pub connected");
  setInterval(() => {
    const now = Date.now();
    const hr = 65 + Math.round(Math.random() * 8);
    const spo2 = 96 + Math.round(Math.random() * 3);
    const sys = 110 + Math.round(Math.random() * 10);
    const dia = 70 + Math.round(Math.random() * 8);
    client.publish(`iomt/${dev}/hr`, JSON.stringify({ ts: now, value: hr }));
    client.publish(`iomt/${dev}/spo2`, JSON.stringify({ ts: now, value: spo2 }));
    client.publish(`iomt/${dev}/sys`, JSON.stringify({ ts: now, value: sys }));
    client.publish(`iomt/${dev}/dia`, JSON.stringify({ ts: now, value: dia }));
  }, 1000);
});
