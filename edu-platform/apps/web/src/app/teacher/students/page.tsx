"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { Enrollment, StudentProgress } from "@/lib/types";

function ProgressRows({ progress }: { progress: StudentProgress }) {
  if (progress.courses.length === 0) {
    return <p className="text-sm text-slate-500">Нет данных по прогрессу.</p>;
  }
  return (
    <div className="space-y-3">
      {progress.courses.map((c) => (
        <div key={c.courseId} className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 font-medium text-slate-900">{c.courseTitle}</p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-slate-500">Прохождение уроков</p>
              <p className="font-semibold text-slate-800">{c.lessonCompletionPct}%</p>
            </div>
            <div>
              <p className="text-slate-500">Проверено ДЗ</p>
              <p className="font-semibold text-slate-800">{c.gradedSubmissions}</p>
            </div>
            <div>
              <p className="text-slate-500">Средний балл</p>
              <p className="font-semibold text-slate-800">
                {c.averageScore != null ? c.averageScore : "—"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Созвоны</p>
              <p className="font-semibold text-slate-800">
                {c.callsUsed} / {c.callsTotal}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StudentCard({ enrollment }: { enrollment: Enrollment }) {
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const student = enrollment.student;
  const name = student ? `${student.firstName} ${student.lastName}` : "Ученик";

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (!student) return;
    if (progress) {
      setOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api.get<StudentProgress>(`/analytics/student/${student.id}`);
      setProgress(data);
      setOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить прогресс");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{name}</p>
          <p className="text-sm text-slate-500">{enrollment.course?.title ?? "Курс"}</p>
        </div>
        <button className="btn-ghost !py-1 text-xs" onClick={toggle} disabled={busy}>
          {busy ? "Загрузка…" : open ? "Скрыть прогресс" : "Показать прогресс"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {open && progress && <ProgressRows progress={progress} />}
    </div>
  );
}

export default function TeacherStudentsPage() {
  const { data, loading, error } = useAsync<Enrollment[]>(
    () => api.get<Enrollment[]>("/enrollments/teaching"),
    [],
  );

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Мои ученики</h1>

      {loading && <p className="text-slate-400">Загрузка…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && data.length === 0 && <p className="text-slate-500">Пока нет прикреплённых учеников.</p>}

      <div className="space-y-4">
        {data?.map((e) => (
          <StudentCard key={e.id} enrollment={e} />
        ))}
      </div>
    </DashboardShell>
  );
}
