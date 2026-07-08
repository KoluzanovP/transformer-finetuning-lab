"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { Call, Enrollment } from "@/lib/types";

const STATUS_RU: Record<Call["status"], string> = {
  AVAILABLE: "Свободно",
  BOOKED: "Забронировано",
  COMPLETED: "Проведено",
  CANCELLED: "Отменено",
};

export default function StudentCallsPage() {
  const enrollments = useAsync<Enrollment[]>(() => api.get<Enrollment[]>("/enrollments/mine"), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = enrollments.data?.find((e) => e.id === selectedId) ?? null;
  const teacherId = selected?.teacher?.id ?? selected?.teacherId ?? null;

  const available = useAsync<Call[]>(
    () => (teacherId ? api.get<Call[]>(`/calls/available?teacherId=${teacherId}`) : Promise.resolve([])),
    [teacherId],
  );
  const mine = useAsync<Call[]>(() => api.get<Call[]>("/calls/mine"), []);

  const book = async (call: Call) => {
    if (!selected) return;
    setBookingId(call.id);
    setError(null);
    try {
      await api.post(`/calls/${call.id}/book`, { courseId: selected.courseId });
      await Promise.all([available.reload(), mine.reload()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось забронировать созвон");
    } finally {
      setBookingId(null);
    }
  };

  const quotaReached = selected ? selected.callsUsed >= selected.callsTotal : false;

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Созвоны</h1>

      {enrollments.loading && <p className="text-slate-400">Загрузка…</p>}
      {enrollments.error && <p className="text-sm text-red-600">{enrollments.error}</p>}

      {enrollments.data && enrollments.data.length === 0 && (
        <p className="text-slate-400">Нет активных курсов для записи на созвоны.</p>
      )}

      {enrollments.data && enrollments.data.length > 0 && (
        <div className="space-y-6">
          <div className="card">
            <label className="label">Выберите курс</label>
            <select
              className="input"
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
            >
              <option value="">— не выбрано —</option>
              {enrollments.data.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.course?.title ?? "Курс"}
                  {e.teacher ? ` — ${e.teacher.firstName} ${e.teacher.lastName}` : ""}
                </option>
              ))}
            </select>

            {selected && (
              <p className="mt-3 text-sm text-slate-600">
                Использовано созвонов: {selected.callsUsed} / {selected.callsTotal}
                {quotaReached && <span className="ml-2 text-amber-600">Лимит исчерпан</span>}
              </p>
            )}
          </div>

          {selected && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Свободные слоты</h2>
              {available.loading && <p className="text-slate-400">Загрузка…</p>}
              {available.error && <p className="text-sm text-red-600">{available.error}</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}

              {available.data && available.data.length === 0 && !available.loading && (
                <p className="text-slate-400">Нет доступных слотов.</p>
              )}

              {available.data && available.data.length > 0 && (
                <ul className="space-y-2">
                  {available.data.map((call) => (
                    <li key={call.id} className="card flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-800">
                          {new Date(call.startsAt).toLocaleString("ru")}
                        </p>
                        <p className="text-xs text-slate-400">{call.durationMinutes} мин</p>
                      </div>
                      <button
                        className="btn-primary"
                        disabled={bookingId === call.id || quotaReached}
                        onClick={() => book(call)}
                      >
                        {bookingId === call.id ? "Бронирование…" : "Забронировать"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Мои созвоны</h2>
            {mine.loading && <p className="text-slate-400">Загрузка…</p>}
            {mine.error && <p className="text-sm text-red-600">{mine.error}</p>}

            {mine.data && mine.data.length === 0 && !mine.loading && (
              <p className="text-slate-400">У вас пока нет записанных созвонов.</p>
            )}

            {mine.data && mine.data.length > 0 && (
              <ul className="space-y-2">
                {mine.data.map((call) => (
                  <li key={call.id} className="card flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-800">
                        {new Date(call.startsAt).toLocaleString("ru")}
                      </p>
                      <p className="text-xs text-slate-400">
                        {call.course?.title ?? "Курс"} · {call.durationMinutes} мин
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="badge bg-slate-100 text-slate-600">{STATUS_RU[call.status]}</span>
                      {call.joinUrl && (
                        <a href={call.joinUrl} target="_blank" rel="noreferrer" className="btn-ghost !py-1">
                          Подключиться
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
