// publish-test.mjs
import 'dotenv/config';
import mqtt from 'mqtt';

const url = process.env.MQTT_URL;
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;
const root = process.env.MQTT_TOPIC_ROOT || 'iomt';
const id = process.env.TEST_DEVICE_ID || 'HealthMonitor-001';

const c = mqtt.connect(url, { username, password });
c.on('connect', () => {
  console.log('publisher connected');
  setInterval(() => {
    const msg = {
      ts: Date.now(),
      hr: 65 + Math.floor(Math.random()*10),
      spo2: 96 + Math.floor(Math.random()*4),
      rr: 12 + Math.floor(Math.random()*5),
      temp_c: 36.5 + Math.random()*0.4
    };
    c.publish(`${root}/${id}/vitals`, JSON.stringify(msg));
  }, 1000);
});
c.on('error', e => console.error('pub error', e?.message||e));
