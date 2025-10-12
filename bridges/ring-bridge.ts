// bridges/ring-bridge.ts
import 'dotenv/config';
import mqtt from 'mqtt';
// If you installed vendor package name:
import SDK from 'smart-ring-js-sdk';
// If it's a local file instead, use:
// import SDK from '../vendor/smart-ring-js-sdk/index.js';

const deviceId = process.env.RING_DEVICE_ID || 'HealthMonitor-001';
const root = process.env.MQTT_TOPIC_ROOT || 'iomt';

const mq = mqtt.connect(process.env.MQTT_URL!, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

(async function main() {
  await SDK.connect();

  SDK.startDetect('openHealth');
  SDK.registerPpgMeasurementListener((d: any) => {
    mq.publish(`${root}/${deviceId}/vitals`, JSON.stringify({
      ts: Date.now(),
      heart_rate: d.heart_rate,
      blood_oxygen: d.blood_oxygen,
      respiratory_rate: d.respiratory_rate,
      hrv: d.hrv,
      stress: d.stress,
      coherence: d['cardiac coherence'],
    }));
  });

  SDK.startDetect('temperature');
  SDK.registerTemperatureListener((t: number) => {
    mq.publish(`${root}/${deviceId}/vitals`, JSON.stringify({ ts: Date.now(), temp_c: t }));
  });

  SDK.startDetect('batteryDataAndState');
  SDK.registerHealthListener((b: any) => {
    mq.publish(`${root}/${deviceId}/vitals`, JSON.stringify({
      ts: Date.now(),
      battery_percent: b.batteryPer,
      wearing: b.isWear,
      is_sleep: b.isSleep,
    }));
  });

  SDK.startDetect((SDK as any).SendCmd?.ACTIVE_DATA ?? 'activeData');
  SDK.registerActivityDataListener((a: any) => {
    mq.publish(`${root}/${deviceId}/activity/daily`, JSON.stringify({
      ts: Date.now(),
      steps: a.total_walk_steps + a.total_run_steps + a.total_other_steps,
      distance_km: a.total_distance,
      kcal_total: a.total_energy,
      kcal_active: a.total_active_energy,
    }));
  });

  console.log('[ring-bridge] running ->', `${root}/${deviceId}/...`);
})();
