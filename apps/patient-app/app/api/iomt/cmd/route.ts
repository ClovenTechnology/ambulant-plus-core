import mqtt from "mqtt";

export const runtime = "nodejs";
process.env.WS_NO_BUFFER_UTIL = "1";
process.env.WS_NO_UTF_8_VALIDATE = "1";

const URL  = process.env.MQTT_URL!;
const USER = process.env.MQTT_USERNAME;
const PASS = process.env.MQTT_PASSWORD;
const ROOT = process.env.MQTT_TOPIC_ROOT || "iomt";

let mq: mqtt.MqttClient | null = null;
function getClient() {
  if (mq) return mq;
  mq = mqtt.connect(URL, { username: USER, password: PASS, keepalive: 30 });
  mq.on("error", (e) => console.error("[mqtt:error]", e?.message || e));
  return mq;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const id  = body?.id ?? body?.deviceId; // <â€” tolerate either
  const cmd = body?.cmd;
  const payload = body?.payload;

  if (!id || !cmd) {
    return new Response(JSON.stringify({ ok: false, message: "id and cmd required" }), { status: 400 });
  }

  const client = getClient();
  const topic = `${ROOT}/cmd/${id}`;

  const msg = JSON.stringify({ cmd, payload, ts: Date.now() });
  try { client.publish(topic, msg); } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: e?.message || String(e) }), { status: 500 });
  }

  return Response.json({ ok: true });
}
