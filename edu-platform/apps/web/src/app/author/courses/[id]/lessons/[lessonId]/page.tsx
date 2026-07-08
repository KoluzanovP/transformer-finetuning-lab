"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { emptyLessonDocument, type LessonDocument } from "@edu/shared";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import { NotebookEditor } from "@/components/notebook/NotebookEditor";
import type { Lesson } from "@/lib/types";

export default function Page({ params }: { params: { id: string; lessonId: string } }) {
  const { id, lessonId } = params;
  const { data, loading, error } = useAsync<Lesson>(() => api.get<Lesson>(`/lessons/${lessonId}`), [lessonId]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<LessonDocument>(emptyLessonDocument());
  const [isPublished, setIsPublished] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setContent(data.content ?? emptyLessonDocument());
      setIsPublished(data.isPublished);
    }
  }, [data]);

  const save = async () => {
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.patch<Lesson>(`/lessons/${lessonId}`, { title, content });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (next: boolean) => {
    setSaveError(null);
    setIsPublished(next);
    try {
      await api.patch<Lesson>(`/lessons/${lessonId}`, { isPublished: next });
    } catch (err) {
      setIsPublished(!next);
      setSaveError(err instanceof ApiError ? err.message : "Не удалось изменить публикацию");
    }
  };

  return (
    <DashboardShell>
      {loading && <p className="text-slate-400">Загрузка…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="space-y-6">
          <div>
            <Link href={`/author/courses/${id}`} className="text-sm text-brand-600 hover:underline">← К курсу</Link>
          </div>

          <div className="card space-y-4">
            <div>
              <label className="label">Название урока</label>
              <input className="input" value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isPublished} onChange={(e) => togglePublished(e.target.checked)} />
              Опубликован
            </label>
            <div className="flex items-center gap-3">
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
              {saved && <span className="text-sm text-green-600">Сохранено ✓</span>}
              {saveError && <span className="text-sm text-red-600">{saveError}</span>}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Содержание</h2>
            <NotebookEditor value={content} onChange={(doc) => { setContent(doc); setSaved(false); }} />
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
