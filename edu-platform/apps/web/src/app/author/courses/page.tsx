"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { Course } from "@/lib/types";

const STATUS_LABELS: Record<Course["status"], string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  ARCHIVED: "В архиве",
};

const STATUS_STYLES: Record<Course["status"], string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PUBLISHED: "bg-green-50 text-green-700",
  ARCHIVED: "bg-amber-50 text-amber-700",
};

export default function AuthorCoursesPage() {
  const { data, loading, error, reload } = useAsync<Course[]>(
    () => api.get<Course[]>("/courses?mine=true"),
    [],
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [callsPerStudent, setCallsPerStudent] = useState(8);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      await api.post<Course>("/courses", {
        title,
        description: description || undefined,
        callsPerStudent,
      });
      setTitle("");
      setDescription("");
      setCallsPerStudent(8);
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось создать курс");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: Course["status"]) => {
    try {
      await api.patch<Course>(`/courses/${id}/status`, { status });
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось изменить статус");
    }
  };

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Курсы</h1>

      <form onSubmit={create} className="card mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Новый курс</h2>
        <div>
          <label className="label">Название</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">Созвонов на ученика</label>
          <input
            className="input w-40"
            type="number"
            min={0}
            value={callsPerStudent}
            onChange={(e) => setCallsPerStudent(Number(e.target.value))}
          />
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? "Создание…" : "Создать курс"}</button>
      </form>

      {loading && <p className="text-slate-400">Загрузка…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && data.length === 0 && <p className="text-slate-500">Пока нет курсов.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {data?.map((c) => (
          <div key={c.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/author/courses/${c.id}`} className="text-lg font-semibold text-brand-700 hover:underline">
                {c.title}
              </Link>
              <span className={`badge ${STATUS_STYLES[c.status]}`}>{STATUS_LABELS[c.status]}</span>
            </div>
            {c.description && <p className="text-sm text-slate-500">{c.description}</p>}
            <div className="flex gap-2">
              {c.status !== "PUBLISHED" && (
                <button className="btn-ghost !py-1 text-xs" onClick={() => setStatus(c.id, "PUBLISHED")}>
                  Опубликовать
                </button>
              )}
              {c.status !== "ARCHIVED" && (
                <button className="btn-ghost !py-1 text-xs" onClick={() => setStatus(c.id, "ARCHIVED")}>
                  В архив
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
