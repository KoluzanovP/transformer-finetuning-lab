"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@edu/shared";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else router.replace(ROLE_HOME[user.roles[0]] ?? "/student");
  }, [user, loading, router]);

  return <div className="grid min-h-screen place-items-center text-slate-400">Загрузка…</div>;
}
