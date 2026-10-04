/* Service Worker de Firebase Cloud Messaging (web push en segundo plano).
 *
 * La config de Firebase NO está hardcodeada: la app lo registra con la config
 * como query params (`/firebase-messaging-sw.js?apiKey=...&projectId=...`), así
 * dev/prod usan su propio environment sin tocar este archivo.
 * La versión del SDK compat debe coincidir con la de `firebase` en package.json.
 */
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
const config = {};
for (const [key, value] of params.entries()) config[key] = value;

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  // Con payload `notification` (lo que envía notifyUsers) el SDK muestra la
  // notificación solo; instanciar messaging basta para registrar el handler.
  firebase.messaging();
}

// Al hacer clic: enfocar una pestaña de la app (navegando a `data.route`) o abrir una nueva.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const route = data.route || (data.FCM_MSG && data.FCM_MSG.data && data.FCM_MSG.data.route) || '/';
  const target = new URL(route, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.focus().then((c) => ('navigate' in c ? c.navigate(target) : c));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
