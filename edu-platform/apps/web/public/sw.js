/* Безопасный сервис-воркер: перехватываем ТОЛЬКО навигации (HTML-страницы).
 * JS/CSS/ассеты и запросы к /api не трогаем — их обрабатывает браузер напрямую,
 * чтобы исключить рассинхрон версий и «белый экран» после передеплоя. */
const CACHE = "edu-shell-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Чистим ВСЕ прежние кэши (в т.ч. сломанные от старых сборок).
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Только переходы по страницам; ассеты и API — мимо воркера.
  if (req.mode !== "navigate") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match("/")),
  );
});
