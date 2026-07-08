"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import { NotebookViewer } from "@/components/notebook/NotebookViewer";
import type { Submission } from "@/lib/types";

interface TeacherAnalytics {
  students: number;
  submissionsGraded: number;
  submissionsPending: number;
  callsCompleted: number;
  callsUpcoming: number;
}

const STATS: { key: keyof TeacherAnalytics; label: string }[] = [
  { key: "students", label: "Учеников" },
  { key: "submissionsGraded", label: "Проверено ДЗ" },
  { key: "submissionsPending", label: "Ждут проверки" },
  { key: "callsCompleted", label: "Проведено созвонов" },
  { key: "callsUpcoming", label: "Предстоящие созвоны" },
];

const STATUS_LABELS: Record<Submission["status"], string> = {
  DRAFT: "Черновик",
  SUBMITTED: "На проверке",
  GRADED: "Принято",
  RETURNED: "На доработку",
};

const STATUS_STYLES: Record<Submission["status"], string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-amber-50 text-amber-700",
  GRADED: "bg-green-50 text-green-700",
  RETURNED: "bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: Submission["status"] }) {
  return <span className={`badge ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export default function TeacherReviewPage() {
  const analytics = useAsync<TeacherAnalytics>(
    () => api.get<TeacherAnalytics>("/analytics/me/teacher"),
    [],
  );
  const queue = useAsync<Submission[]>(() => api.get<Submission[]>("/submissions/queue"), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useAsync<Submission | null>(
    () => (selectedId ? api.get<Submission>(`/submissions/${selectedId}`) : Promise.resolve(null)),
    [selectedId],
  );

  const [reviewStatus, setReviewStatus] = useState<"GRADED" | "RETURNED">("GRADED");
  const [score, setScore] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const select = (id: string) => {
    setSelectedId(id);
    setReviewStatus("GRADED");
    setScore("");
    setFormError(null);
    setConfirmation(null);
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setFormError(null);
    setConfirmation(null);
    setBusy(true);
    try {
      const body: { status: "GRADED" | "RETURNED"; score?: number } = { status: reviewStatus };
      if (reviewStatus === "GRADED") body.score = Number(score);
      await api.put<Submission>(`/submissions/${selectedId}/review`, body);
      setConfirmation(reviewStatus === "GRADED" ? "Работа оценена." : "Работа возвращена на доработку.");
      await queue.reload();
      await detail.reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось сохранить проверку");
    } finally {
      setBusy(false);
    }
  };

  const maxScore = detail.data?.homework?.maxScore ?? 100;

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Проверка ДЗ</h1>

      {analytics.loading && <p className="text-slate-400">Загрузка…</p>}
      {analytics.error && <p className="text-sm text-red-600">{analytics.error}</p>}
      {analytics.data && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {STATS.map((s) => (
            <div key={s.key} className="card">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-2 text-3xl font-bold text-brand-700">{analytics.data![s.key]}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Очередь работ</h2>
          {queue.loading && <p className="text-slate-400">Загрузка…</p>}
          {queue.error && <p className="text-sm text-red-600">{queue.error}</p>}
          {queue.data && queue.data.length === 0 && (
            <p className="text-slate-500">Нет работ на проверке.</p>
          )}
          <div className="space-y-2">
            {queue.data?.map((s) => (
              <button
                key={s.id}
                onClick={() => select(s.id)}
                className={`card w-full text-left transition hover:border-brand-300 ${
                  selectedId === s.id ? "border-brand-500 ring-2 ring-brand-100" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{s.homework?.title ?? "Домашнее задание"}</p>
                    <p className="text-sm text-slate-500">
                      {s.student ? `${s.student.firstName} ${s.student.lastName}` : "Ученик"}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                {s.status === "GRADED" && s.score != null && (
                  <p className="mt-1 text-sm text-slate-600">
                    Оценка: {s.score}
                    {s.homework ? ` / ${s.homework.maxScore}` : ""}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Проверка</h2>
          {!selectedId && <p className="text-slate-500">Выберите работу из очереди слева.</p>}
          {selectedId && detail.loading && <p className="text-slate-400">Загрузка…</p>}
          {selectedId && detail.error && <p className="text-sm text-red-600">{detail.error}</p>}
          {detail.data && (
            <div className="space-y-4">
              <div className="card">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{detail.data.homework?.title}</p>
                    <p className="text-sm text-slate-500">
                      {detail.data.student
                        ? `${detail.data.student.firstName} ${detail.data.student.lastName}`
                        : "Ученик"}
                    </p>
                  </div>
                  <StatusBadge status={detail.data.status} />
                </div>
                <NotebookViewer doc={detail.data.content} />
              </div>

              <form onSubmit={submitReview} className="card space-y-4">
                <h3 className="text-base font-semibold text-slate-900">Результат проверки</h3>
                <div>
                  <label className="label">Статус</label>
                  <select
                    className="input"
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value as "GRADED" | "RETURNED")}
                  >
                    <option value="GRADED">Принять (с оценкой)</option>
                    <option value="RETURNED">Вернуть на доработку</option>
                  </select>
                </div>
                {reviewStatus === "GRADED" && (
                  <div>
                    <label className="label">Оценка (макс. {maxScore})</label>
                    <input
                      className="input w-40"
                      type="number"
                      min={0}
                      max={maxScore}
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      required
                    />
                  </div>
                )}
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                {confirmation && <p className="text-sm text-green-700">{confirmation}</p>}
                <button className="btn-primary" disabled={busy}>
                  {busy ? "Сохранение…" : "Сохранить"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
