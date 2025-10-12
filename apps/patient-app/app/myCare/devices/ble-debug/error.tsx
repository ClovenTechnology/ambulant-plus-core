'use client';
export default function Error({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="p-6">
      <div className="font-medium mb-2">BLE Debug Error</div>
      <pre className="text-xs bg-rose-50 text-rose-700 p-3 rounded">{String(error?.stack || error?.message)}</pre>
    </main>
  );
}