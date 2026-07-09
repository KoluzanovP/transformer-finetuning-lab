/* Отключённый сервис-воркер: сам себя удаляет и чистит кэши.
 * (PWA временно выключен, чтобы исключить кэш как причину проблем.) */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.navigate(c.url));
    })(),
  );
});
