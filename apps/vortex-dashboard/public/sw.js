/**
 * Vortex Console Service Worker
 *
 * Receives Web Push notifications and displays native OS notifications.
 * Also handles notification click events.
 */

// Push event — receive a push notification from the server
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.notification?.title || data.title || 'Vortex';
  const body = data.notification?.body || data.body || '';
  const openUrl = data.url || data.data?.url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url: openUrl },
      requireInteraction: false,
      tag: 'vortex-notification',
    }),
  );
});

// Notification click — open the URL when the user clicks the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(
      (clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      },
    ),
  );
});

// Message event — allow the page to check subscription status
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_SUBSCRIPTION') {
    event.source.postMessage({
      type: 'SUBSCRIPTION_INFO',
      subscription: self.registration.pushSubscription,
    });
  }
});
