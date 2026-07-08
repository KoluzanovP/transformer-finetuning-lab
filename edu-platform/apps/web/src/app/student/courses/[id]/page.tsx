"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { Course } from "@/lib/types";

export default function StudentCoursePage({ params }: { params: { id: string } }) {
  const { data, loading, error } = useAsync<Course>(
    () => api.get<Course>(`/courses/${params.id}`),
    [params.id],
  );

  const lessons = (data?.lessons ?? []).slice().sort((a, b) => a.order - b.order);
  const homeworks = data?.homeworks ?? [];

  return (
    <DashboardShell>
      <Link href="/student" className="text-sm text-brand-600">← К моим курсам</Link>

      {loading && <p className="mt-4 text-slate-400">Загрузка…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {data && (
        <div className="mt-2 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{data.title}</h1>
            {data.description && <p className="mt-1 text-slate-500">{data.description}</p>}
          </div>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Уроки</h2>
            {lessons.length === 0 ? (
              <p className="text-slate-400">В курсе пока нет уроков.</p>
            ) : (
              <ol className="space-y-2">
                {lessons.map((lesson, i) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/student/lessons/${lesson.id}`}
                      className="card flex items-center gap-3 hover:border-brand-300"
                    >
                      <span className="badge bg-brand-50 text-brand-700">{i + 1}</span>
                      <span className="font-medium text-slate-800">{lesson.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Домашние задания</h2>
            {homeworks.length === 0 ? (
              <p className="text-slate-400">Домашних заданий нет.</p>
            ) : (
              <ul className="space-y-2">
                {homeworks.map((hw) => (
                  <li key={hw.id} className="card">
                    <p className="font-medium text-slate-800">{hw.title}</p>
                    {hw.description && <p className="mt-1 text-sm text-slate-500">{hw.description}</p>}
                    <p className="mt-1 text-xs text-slate-400">Максимальный балл: {hw.maxScore}</p>
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
