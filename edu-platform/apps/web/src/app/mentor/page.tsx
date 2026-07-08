"use client";

import { useState } from "react";
import { TicketStatus } from "@edu/shared";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { Ticket, TicketMessage } from "@/lib/types";

type Person = { id: string; firstName: string; lastName: string };
type TicketWithPeople = Ticket & {
  createdBy?: Person | null;
  mentor?: Person | null;
};

const STATUS_LABELS: Record<Ticket["status"], string> = {
  OPEN: "Открыт",
  IN_PROGRESS: "В работе",
  RESOLVED: "Решён",
  CLOSED: "Закрыт",
};

const STATUS_STYLES: Record<Ticket["status"], string> = {
  OPEN: "bg-amber-50 text-amber-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  RESOLVED: "bg-green-50 text-green-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

function personName(p?: Person | null): string {
  return p ? `${p.firstName} ${p.lastName}` : "Пользователь";
}

export default function MentorTicketsPage() {
  const queue = useAsync<TicketWithPeople[]>(
    () => api.get<TicketWithPeople[]>("/tickets/queue"),
    [],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useAsync<TicketWithPeople | null>(
    () => (selectedId ? api.get<TicketWithPeople>(`/tickets/${selectedId}`) : Promise.resolve(null)),
    [selectedId],
  );

  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await api.post<TicketMessage>(`/tickets/${selectedId}/messages`, { body: reply });
      setReply("");
      await detail.reload();
      await queue.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось отправить сообщение");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: Ticket["status"]) => {
    if (!selectedId) return;
    setError(null);
    try {
      await api.put<Ticket>(`/tickets/${selectedId}/status`, { status });
      await detail.reload();
      await queue.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось изменить статус");
    }
  };

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Тикеты (поддержка)</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Очередь</h2>
          {queue.loading && <p className="text-slate-400">Загрузка…</p>}
          {queue.error && <p className="text-sm text-red-600">{queue.error}</p>}
          {queue.data && queue.data.length === 0 && <p className="text-slate-500">Нет тикетов.</p>}
          <div className="space-y-2">
            {queue.data?.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`card w-full text-left transition hover:border-brand-300 ${
                  selectedId === t.id ? "border-brand-500 ring-2 ring-brand-100" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{t.subject}</p>
                    <p className="text-sm text-slate-500">{personName(t.createdBy)}</p>
                  </div>
                  <span className={`badge ${STATUS_STYLES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Обсуждение</h2>
          {!selectedId && <p className="text-slate-500">Выберите тикет из очереди слева.</p>}
          {selectedId && detail.loading && <p className="text-slate-400">Загрузка…</p>}
          {selectedId && detail.error && <p className="text-sm text-red-600">{detail.error}</p>}
          {detail.data && (
            <div className="space-y-4">
              <div className="card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{detail.data.subject}</p>
                    <p className="text-sm text-slate-500">Автор: {personName(detail.data.createdBy)}</p>
                  </div>
                  <span className={`badge ${STATUS_STYLES[detail.data.status]}`}>
                    {STATUS_LABELS[detail.data.status]}
                  </span>
                </div>
                <div>
                  <label className="label">Статус тикета</label>
                  <select
                    className="input"
                    value={detail.data.status}
                    onChange={(e) => changeStatus(e.target.value as Ticket["status"])}
                  >
                    {Object.values(TicketStatus).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="card space-y-3">
                {detail.data.messages && detail.data.messages.length > 0 ? (
                  detail.data.messages.map((m) => (
                    <div key={m.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-800">{personName(m.sender)}</span>
                        <span className="text-slate-400">
                          {new Date(m.createdAt).toLocaleString("ru-RU")}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{m.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Сообщений пока нет.</p>
                )}
              </div>

              <form onSubmit={sendReply} className="card space-y-3">
                <div>
                  <label className="label">Ответ</label>
                  <textarea
                    className="input min-h-[90px]"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Введите сообщение…"
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button className="btn-primary" disabled={busy || !reply.trim()}>
                  {busy ? "Отправка…" : "Отправить"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
