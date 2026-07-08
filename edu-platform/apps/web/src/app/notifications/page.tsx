"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

interface Notif {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

const LABELS: Record<string, string> = {
  "submission.submitted": "Новая работа на проверку",
  "submission.graded": "Ваша работа оценена",
  "submission.returned": "Работа возвращена на доработку",
  "call.booked": "Забронирован созвон",
  "call.cancelled": "Созвон отменён",
  "ticket.reply": "Ответ в обращении",
  "comment.reply": "Ответ на комментарий",
};

export default function NotificationsPage() {
  const { data, loading, reload } = useAsync(() => api.get<Notif[]>("/notifications"), []);

  const markAll = async () => {
    await api.post("/notifications/read-all");
    await reload();
  };
  const markOne = async (id: string) => {
    await api.post(`/notifications/${id}/read`);
    await reload();
  };

  return (
    <DashboardShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Уведомления</h1>
        <button className="btn-ghost" onClick={markAll}>Отметить все прочитанными</button>
      </div>
      {loading && <p className="text-slate-400">Загрузка…</p>}
      {data && data.length === 0 && <p className="text-slate-400">Уведомлений нет.</p>}
      <div className="space-y-2">
        {data?.map((n) => (
          <div
            key={n.id}
            className={`card flex items-center justify-between ${n.readAt ? "opacity-60" : "border-brand-300"}`}
          >
            <div>
              <p className="font-medium">{LABELS[n.type] ?? n.type}</p>
              <p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString("ru")}</p>
            </div>
            {!n.readAt && (
              <button className="btn-ghost !py-1 text-xs" onClick={() => markOne(n.id)}>Прочитано</button>
            )}
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
