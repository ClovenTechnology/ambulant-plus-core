// public/reminders-sw.js

// Note: This runs in the service worker context, not in the page.

self.addEventListener('install', (event) => {
  // You could pre-cache assets if you want; kept minimal here.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of existing clients ASAP.
  event.waitUntil(self.clients.claim());
});

/**
 * Handle incoming push messages from the backend (Web Push).
 * Expected payload shape (JSON):
 * {
 *   "title": "Time for your evening walk",
 *   "body": "30 min · Moderate · 18:30",
 *   "tag": "reminder:<id>",
 *   "data": { "url": "/reminder", "reminderId": "<id>" }
 * }
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'NexRing reminder';
  const options = {
    body: payload.body || '',
    tag: payload.tag || 'reminder',
    data: payload.data || {},
    icon: '/icons/reminder-192.png', // optional – add real assets
    badge: '/icons/reminder-badge.png', // optional
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * When the user taps the notification, focus an existing reminder tab
 * if possible; otherwise open a new /reminder tab.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/reminder';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client && client.url.includes(targetUrl)) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      }),
  );
});
