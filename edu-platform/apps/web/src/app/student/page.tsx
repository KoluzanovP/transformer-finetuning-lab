"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { Enrollment, StudentProgress } from "@/lib/types";

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StudentCoursesPage() {
  const enrollments = useAsync<Enrollment[]>(() => api.get<Enrollment[]>("/enrollments/mine"), []);
  const progress = useAsync<StudentProgress>(() => api.get<StudentProgress>("/analytics/me/student"), []);

  const progressFor = (courseId: string) =>
    progress.data?.courses.find((c) => c.courseId === courseId) ?? null;

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Мои курсы</h1>

      {enrollments.loading && <p className="text-slate-400">Загрузка…</p>}
      {enrollments.error && <p className="text-sm text-red-600">{enrollments.error}</p>}

      {enrollments.data && enrollments.data.length === 0 && (
        <p className="text-slate-400">Вы пока не записаны ни на один курс.</p>
      )}

      {enrollments.data && enrollments.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {enrollments.data.map((e) => {
            const p = progressFor(e.courseId);
            const callsTotal = e.callsTotal || 0;
            const callsPct = callsTotal ? (e.callsUsed / callsTotal) * 100 : 0;
            return (
              <Link key={e.id} href={`/student/courses/${e.courseId}`} className="card block hover:border-brand-300">
                <h2 className="text-lg font-semibold text-slate-900">
                  {e.course?.title ?? "Курс"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Уроков: {e.course?._count?.lessons ?? 0}
                </p>
                {e.teacher && (
                  <p className="text-sm text-slate-500">
                    Преподаватель: {e.teacher.firstName} {e.teacher.lastName}
                  </p>
                )}

                {p && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>Пройдено уроков</span>
                      <span>{Math.round(p.lessonCompletionPct)}%</span>
                    </div>
                    <ProgressBar value={p.lessonCompletionPct} />
                    <p className="mt-2 text-sm text-slate-600">
                      Средний балл: {p.averageScore ?? "—"}
                    </p>
                  </div>
                )}

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Созвоны</span>
                    <span>{e.callsUsed} / {callsTotal}</span>
                  </div>
                  <ProgressBar value={callsPct} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
