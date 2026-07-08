"use client";

import { useEffect } from "react";

/** Регистрирует сервис-воркер для офлайн-доступа и установки как приложение. */
export function PWARegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* офлайн-режим необязателен */
      });
    }
  }, []);
  return null;
}
