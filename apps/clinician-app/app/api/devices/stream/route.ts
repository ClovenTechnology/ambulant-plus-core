// apps/clinician-app/app/api/devices/stream/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mockValue(stream: string) {
  switch (stream) {
    case 'heartRate':
      return 65 + Math.floor(Math.random() * 20);
    case 'hrv':
      return 40 + Math.floor(Math.random() * 20);
    case 'spo2':
      return 96 + Math.floor(Math.random() * 3);
    case 'temperature':
      return (36.4 + Math.random() * 0.6).toFixed(1);
    case 'bpSystolic':
      return 118 + Math.floor(Math.random() * 10);
    case 'bpDiastolic':
      return 78 + Math.floor(Math.random() * 8);
    case 'respiratoryRate':
      return 14 + Math.floor(Math.random() * 4);
    default:
      return Math.floor(Math.random() * 100);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stream = searchParams.get('stream') || 'heartRate';
  const encoder = new TextEncoder();

  let interval: ReturnType<typeof setInterval> | null = null;
  let killer: ReturnType<typeof setTimeout> | null = null;

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      interval = setInterval(() => {
        const payload = JSON.stringify({ stream, value: mockValue(stream), ts: Date.now() });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }, 1000);

      // close after 15 minutes
      killer = setTimeout(() => {
        if (interval) clearInterval(interval);
        controller.close();
      }, 15 * 60 * 1000);
    },
    cancel() {
      if (interval) clearInterval(interval);
      if (killer) clearTimeout(killer);
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
