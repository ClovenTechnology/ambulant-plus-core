// apps/patient-app/lib/pushBrowser.ts
/**
 * Utilities for registering the reminders service worker and subscribing
 * to web push so the backend can send real browser notifications.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Decode a URL-safe base64 VAPID public key into a plain ArrayBuffer.
 *
 * PushManager.subscribe() expects applicationServerKey to be a BufferSource
 * backed by ArrayBuffer, not ArrayBufferLike/SharedArrayBuffer.
 */
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);

  const base64 = `${base64String}${padding}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputBuffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(outputBuffer);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputBuffer;
}

export async function ensureRemindersPushSubscription(): Promise<PushSubscription | null> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.warn('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY — skipping push setup.');
    return null;
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    console.warn('Notification permission was not granted — skipping push setup.');
    return null;
  }

  // Register the service worker from /public/reminders-sw.js.
  const registration = await navigator.serviceWorker.register('/reminders-sw.js');

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
    });
  }

  await fetch('/api/reminder-push/subscribe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      subscription,
    }),
  });

  return subscription;
}