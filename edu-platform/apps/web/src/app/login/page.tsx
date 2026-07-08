"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@edu/shared";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("author@edu.dev");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email, password);
      router.replace(ROLE_HOME[user.roles[0]] ?? "/student");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-brand-700">EduPlatform</h1>
        <p className="mb-6 text-sm text-slate-500">Вход в личный кабинет</p>
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Вход…" : "Войти"}</button>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> или <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="flex gap-2">
            <a className="btn-ghost flex-1" href={`${API}/api/auth/google/start`}>Google</a>
            <a className="btn-ghost flex-1" href={`${API}/api/auth/vk/start`}>VK</a>
          </div>

          <p className="text-center text-sm text-slate-500">
            Нет аккаунта? <Link href="/register" className="text-brand-600">Регистрация</Link>
          </p>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          Демо: author@edu.dev / teacher@edu.dev / student@edu.dev … (пароль password123)
        </p>
      </div>
    </div>
  );
}
