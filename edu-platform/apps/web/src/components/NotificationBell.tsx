"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api.get<{ count: number }>("/notifications/unread-count");
        if (active) setCount(res.count);
      } catch {
        /* ignore */
      }
    };
    void load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <Link href="/notifications" className="relative rounded-lg px-2 py-1 text-lg hover:bg-slate-100" title="Уведомления">
      🔔
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
