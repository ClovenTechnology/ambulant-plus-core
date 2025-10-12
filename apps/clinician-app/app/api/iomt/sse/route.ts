import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        try {
          // Only enqueue if controller is still active
          if (controller.desiredSize !== null) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ ts: Date.now() })}\n\n`)
            );
          }
        } catch (err) {
          console.error('SSE enqueue error:', err);
          clearInterval(interval);
        }
      }, 5000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    cancel() {
      console.log('SSE client disconnected');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
