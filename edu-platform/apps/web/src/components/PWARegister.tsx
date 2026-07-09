"use client";

import { useEffect } from "react";

/**
 * PWA временно отключён. Компонент активно удаляет ранее установленный
 * сервис-воркер и чистит кэши, чтобы исключить «белый экран» из-за старого кэша.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);
  return null;
}
