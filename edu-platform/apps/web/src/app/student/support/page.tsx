"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { Ticket } from "@/lib/types";

const STATUS_RU: Record<Ticket["status"], string> = {
  OPEN: "Открыт",
  IN_PROGRESS: "В работе",
  RESOLVED: "Решён",
  CLOSED: "Закрыт",
};

export default function StudentSupportPage() {
  const tickets = useAsync<Ticket[]>(() => api.get<Ticket[]>("/tickets/mine"), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const detail = useAsync<Ticket | null>(
    () => (selectedId ? api.get<Ticket>(`/tickets/${selectedId}`) : Promise.resolve(null)),
    [selectedId],
  );

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await api.post<Ticket>("/tickets", { subject, body });
      setSubject("");
      setBody("");
      await tickets.reload();
      setSelectedId(created.id);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Не удалось создать обращение");
    } finally {
      setCreating(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setReplying(true);
    setReplyError(null);
    try {
      await api.post(`/tickets/${selectedId}/messages`, { body: reply });
      setReply("");
      await detail.reload();
    } catch (err) {
      setReplyError(err instanceof ApiError ? err.message : "Не удалось отправить сообщение");
    } finally {
      setReplying(false);
    }
  };

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Поддержка</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <form onSubmit={createTicket} className="card space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Новое обращение</h2>
            <div>
              <label className="label">Тема</label>
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Кратко опишите вопрос"
              />
            </div>
            <div>
              <label className="label">Сообщение</label>
              <textarea
                className="input min-h-[100px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Подробности"
              />
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <button className="btn-primary" disabled={creating || !subject.trim() || !body.trim()}>
              {creating ? "Создание…" : "Создать обращение"}
            </button>
          </form>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Мои обращения</h2>
            {tickets.loading && <p className="text-slate-400">Загрузка…</p>}
            {tickets.error && <p className="text-sm text-red-600">{tickets.error}</p>}
            {tickets.data && tickets.data.length === 0 && (
              <p className="text-slate-400">У вас пока нет обращений.</p>
            )}
            {tickets.data && tickets.data.length > 0 && (
              <ul className="space-y-2">
                {tickets.data.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelectedId(t.id)}
                      className={`card block w-full text-left hover:border-brand-300 ${
                        selectedId === t.id ? "border-brand-400" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">{t.subject}</span>
                        <span className="badge bg-slate-100 text-slate-600">{STATUS_RU[t.status]}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(t.createdAt).toLocaleString("ru")}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          {!selectedId && <p className="text-slate-400">Выберите обращение, чтобы увидеть переписку.</p>}

          {selectedId && (
            <div className="space-y-4">
              {detail.loading && <p className="text-slate-400">Загрузка…</p>}
              {detail.error && <p className="text-sm text-red-600">{detail.error}</p>}

              {detail.data && (
                <>
                  <div className="card">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">{detail.data.subject}</h2>
                      <span className="badge bg-slate-100 text-slate-600">
                        {STATUS_RU[detail.data.status]}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {(detail.data.messages ?? []).map((m) => (
                      <li key={m.id} className="card">
                        <p className="text-sm font-medium text-slate-800">
                          {m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : "Сообщение"}
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            {new Date(m.createdAt).toLocaleString("ru")}
                          </span>
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{m.body}</p>
                      </li>
                    ))}
                    {(detail.data.messages ?? []).length === 0 && (
                      <li className="text-slate-400">Сообщений пока нет.</li>
                    )}
                  </ul>

                  <form onSubmit={sendReply} className="card space-y-2">
                    <label className="label">Ответить</label>
                    <textarea
                      className="input min-h-[80px]"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Ваше сообщение"
                    />
                    {replyError && <p className="text-sm text-red-600">{replyError}</p>}
                    <button className="btn-primary" disabled={replying || !reply.trim()}>
                      {replying ? "Отправка…" : "Отправить"}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
