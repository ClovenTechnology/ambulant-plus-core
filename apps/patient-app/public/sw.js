// ============================================================================
// public/sw.js
// Service Worker for Web Push notifications (safe no-op if not registered).
// ============================================================================
/* eslint-disable no-restricted-globals */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || 'Reminder';
  const body = data.body || 'You have a new reminder.';
  const tag = data.tag || 'duecare';
  const url = data.url;
  const options = {
    body,
    tag,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url;
  if (url) {
    event.waitUntil(clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const hadWindow = clientsArr.some((c) => c.url === url && 'focus' in c && c.focus());
      if (!hadWindow && clients.openWindow) return clients.openWindow(url);
    }));
  }
});
