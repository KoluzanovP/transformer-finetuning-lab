"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { Call } from "@/lib/types";

const STATUS_LABELS: Record<Call["status"], string> = {
  AVAILABLE: "Свободен",
  BOOKED: "Забронирован",
  COMPLETED: "Проведён",
  CANCELLED: "Отменён",
};

const STATUS_STYLES: Record<Call["status"], string> = {
  AVAILABLE: "bg-blue-50 text-blue-700",
  BOOKED: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

export default function TeacherCallsPage() {
  const { data, loading, error, reload } = useAsync<Call[]>(
    () => api.get<Call[]>("/calls/teaching"),
    [],
  );

  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      await api.post<Call>("/calls", {
        startsAt: new Date(startsAt).toISOString(),
        durationMinutes,
      });
      setStartsAt("");
      setDurationMinutes(30);
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось создать слот");
    } finally {
      setBusy(false);
    }
  };

  const complete = async (id: string) => {
    try {
      await api.post<Call>(`/calls/${id}/complete`, {});
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось завершить созвон");
    }
  };

  const cancel = async (id: string) => {
    try {
      await api.post<Call>(`/calls/${id}/cancel`);
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось отменить созвон");
    }
  };

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Созвоны</h1>

      <form onSubmit={create} className="card mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Новый слот</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label">Дата и время</label>
            <input
              className="input"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Длительность (мин)</label>
            <input
              className="input w-40"
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </div>
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Создание…" : "Создать слот"}
        </button>
      </form>

      {loading && <p className="text-slate-400">Загрузка…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && data.length === 0 && <p className="text-slate-500">Пока нет созвонов.</p>}

      <div className="space-y-3">
        {data?.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">
                {new Date(c.startsAt).toLocaleString("ru-RU")}
              </p>
              <p className="text-sm text-slate-500">
                {c.durationMinutes} мин
                {c.course?.title ? ` · ${c.course.title}` : ""}
              </p>
              {c.joinUrl && (
                <a
                  href={c.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand-600 hover:underline"
                >
                  Ссылка на созвон
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${STATUS_STYLES[c.status]}`}>{STATUS_LABELS[c.status]}</span>
              {c.status === "BOOKED" && (
                <>
                  <button className="btn-ghost !py-1 text-xs" onClick={() => complete(c.id)}>
                    Завершить
                  </button>
                  <button className="btn-ghost !py-1 text-xs" onClick={() => cancel(c.id)}>
                    Отменить
                  </button>
                </>
              )}
              {c.status === "AVAILABLE" && (
                <button className="btn-ghost !py-1 text-xs" onClick={() => cancel(c.id)}>
                  Отменить
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
