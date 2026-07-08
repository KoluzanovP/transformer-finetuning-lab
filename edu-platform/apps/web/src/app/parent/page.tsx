"use client";

import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { StudentProgress, UserRow } from "@/lib/types";

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ChildProgress({ child }: { child: UserRow }) {
  const { data, loading, error } = useAsync<StudentProgress>(
    () => api.get<StudentProgress>(`/analytics/child/${child.id}`),
    [child.id],
  );

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">
        {child.firstName} {child.lastName}
      </h2>

      {loading && <p className="text-slate-400">Загрузка…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && data.courses.length === 0 && (
        <p className="text-slate-400">Нет курсов.</p>
      )}

      {data && data.courses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.courses.map((c) => (
            <div key={c.courseId} className="card space-y-3">
              <div>
                <h3 className="font-semibold text-slate-900">{c.courseTitle}</h3>
                {c.teacher && (
                  <p className="text-sm text-slate-500">
                    Преподаватель: {c.teacher.firstName} {c.teacher.lastName}
                  </p>
                )}
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Пройдено уроков</span>
                  <span>{Math.round(c.lessonCompletionPct)}%</span>
                </div>
                <ProgressBar value={c.lessonCompletionPct} />
              </div>

              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-slate-500">Проверено ДЗ</dt>
                  <dd className="font-medium text-slate-800">
                    {c.gradedSubmissions} / {c.totalHomework}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Средний балл</dt>
                  <dd className="font-medium text-slate-800">{c.averageScore ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Созвоны</dt>
                  <dd className="font-medium text-slate-800">
                    {c.callsUsed} / {c.callsTotal}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ParentPage() {
  const children = useAsync<UserRow[]>(() => api.get<UserRow[]>("/users/me/children"), []);

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Мои дети</h1>

      {children.loading && <p className="text-slate-400">Загрузка…</p>}
      {children.error && <p className="text-sm text-red-600">{children.error}</p>}

      {children.data && children.data.length === 0 && (
        <p className="text-slate-400">К вашему аккаунту не привязаны ученики.</p>
      )}

      {children.data && children.data.length > 0 && (
        <div className="space-y-8">
          {children.data.map((child) => (
            <ChildProgress key={child.id} child={child} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
