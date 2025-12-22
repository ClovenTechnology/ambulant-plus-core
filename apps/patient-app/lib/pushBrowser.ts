// lib/pushBrowser.ts
/**
 * Utilities for registering the reminders service worker and subscribing
 * to web push so the backend can send real browser notifications.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Decode a URL-safe base64 string into a Uint8Array for PushManager.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = typeof window !== 'undefined'
    ? window.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');

  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function ensureRemindersPushSubscription() {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.warn('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY – skipping push setup.');
    return null;
  }

  // 1) Register the service worker (served from /public)
  const registration = await navigator.serviceWorker.register('/reminders-sw.js');

  // 2) Get or create a push subscription
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // 3) Send subscription to backend so it can store it (per patient + device)
  await fetch('/api/reminder-push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      subscription,
      // you can add patientId / device metadata here if you like
    }),
  });

  return subscription;
}
