/* Server-only MQTT ↔ SSE fanout. */
import mqtt, { MqttClient, IClientOptions } from "mqtt";

type Sink = (evt: string, data: any) => void;
type SinkSet = Set<Sink>;

const g = globalThis as any;

// reuse across HMR in dev
if (!g.__IOMT__) {
  g.__IOMT__ = {
    client: null as MqttClient | null,
    sinks: new Map<string, SinkSet>(),    // deviceId -> set of SSE sinks
    subs: new Set<string>(),              // topics actually subscribed
    topicRoot: process.env.MQTT_TOPIC_ROOT || "iomt",
  };
}
const S = g.__IOMT__;

function ensureClient(): MqttClient {
  if (S.client) return S.client;

  const url = process.env.MQTT_URL!;
  const opts: IClientOptions = {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    // MQTT v5 works great; fall back seamlessly:
    protocolVersion: 5,
    reconnectPeriod: 1500,
    connectTimeout: 10_000,
    // accept self-signed labs; tighten for prod:
    rejectUnauthorized: false,
  };

  const client = mqtt.connect(url, opts);
  client.on("connect", () => {
    console.log("[IOMT] MQTT connected", url);
  });
  client.on("reconnect", () => console.log("[IOMT] reconnecting…"));
  client.on("error", (e) => console.error("[IOMT] error", e?.message));
  client.on("close", () => console.log("[IOMT] closed"));

  client.on("message", (topic, buf) => {
    try {
      const t = topic.split("/");
      const root = t[0];
      if (root !== S.topicRoot) return;

      const deviceId = t[1] || "unknown";
      const metric = t[2] || "unknown";

      let payload: any = buf.toString("utf8");
      try { payload = JSON.parse(payload); } catch { /* keep string/number */ }

      const ts = (payload?.ts as number) ?? Date.now();
      const value =
        payload?.value ?? payload?.val ?? payload?.v ?? payload?.data ?? payload;

      const data = { deviceId, metric, value, ts, raw: payload };

      const sinks: SinkSet | undefined = S.sinks.get(deviceId);
      if (sinks && sinks.size) {
        for (const send of sinks) send("vital", data);
      }
    } catch (e) {
      console.error("[IOMT] message parse error:", e);
    }
  });

  S.client = client;
  return client;
}

export function attachDevice(deviceId: string, send: Sink) {
  ensureClient();
  let set = S.sinks.get(deviceId);
  if (!set) {
    set = new Set();
    S.sinks.set(deviceId, set);
  }
  set.add(send);

  // Subscribe lazily per device
  const topic = `${S.topicRoot}/${deviceId}/#`;
  if (!S.subs.has(topic)) {
    S.client!.subscribe(topic, { qos: 0 }, (err) => {
      if (!err) S.subs.add(topic);
      else console.error("[IOMT] subscribe error:", topic, err.message);
    });
  }
}

export function detachDevice(deviceId: string, send: Sink) {
  const set = S.sinks.get(deviceId);
  if (!set) return;
  set.delete(send);
  if (set.size === 0) {
    S.sinks.delete(deviceId);
    const topic = `${S.topicRoot}/${deviceId}/#`;
    if (S.subs.has(topic)) {
      S.client?.unsubscribe(topic, () => S.subs.delete(topic));
    }
  }
}
