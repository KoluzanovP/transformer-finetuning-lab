"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tokenStore } from "@/lib/api";

/**
 * Принимает токены из hash-фрагмента после OAuth-редиректа
 * (#access=...&refresh=...), сохраняет их и уходит в кабинет.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const access = params.get("access");
    const refresh = params.get("refresh");
    if (access && refresh) {
      tokenStore.set(access, refresh);
      router.replace("/");
    } else {
      setError("Не удалось получить токены авторизации");
    }
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center text-slate-400">
      {error ?? "Завершаем вход…"}
    </div>
  );
}
