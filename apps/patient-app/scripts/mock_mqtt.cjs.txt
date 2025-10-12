// … keep the top as you already have it …
c.on("connect", () => {
  console.log("[mock] connected to", URL, "publishing under", `${ROOT}/${DEV}/#`);

  setInterval(() => pub("hr",    65 + Math.round(Math.random()*10)), 1000);
  setInterval(() => pub("spo2",  96 + Math.round(Math.random()*3)),  1100);
  setInterval(() => { const sys=110+Math.round(Math.random()*20); const dia=70+Math.round(Math.random()*10); pub("sys",sys); pub("dia",dia); }, 1500);
  setInterval(() => pub("rr",    12 + Math.round(Math.random()*6)),  1600);
  setInterval(() => pub("temp",  36.5 + Math.random()*0.6),          2500);
  setInterval(() => pub("glucose", 90 + Math.round(Math.random()*40)), 3000);

  // NEW: activity once every ~8s
  setInterval(() => {
    const payload = {
      ts: Date.now(),
      steps: 4000 + Math.round(Math.random()*3000),
      distance_km: 2 + Math.round(Math.random()*60)/10,
      kcal_total: 1200 + Math.round(Math.random()*600),
      kcal_active: 400 + Math.round(Math.random()*300),
    };
    c.publish(`${ROOT}/${DEV}/activity/daily`, JSON.stringify(payload));
  }, 8000);

  // NEW: sleep summary every ~30s
  setInterval(() => {
    const now = Date.now();
    const payload = {
      sleep_start: now - 7.5*60*60*1000,
      sleep_end: now,
      deep_min: 80, light_min: 260, rem_min: 90, wake_min: 20
    };
    c.publish(`${ROOT}/${DEV}/sleep/summary`, JSON.stringify(payload));
  }, 30000);
});

function pub(metric, value) {
  const topic = `${ROOT}/${DEV}/${metric}`;
  const payload = JSON.stringify({ value, ts: Date.now() });
  c.publish(topic, payload);
}
