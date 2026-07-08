"use client";

import { useState } from "react";
import { emptyLessonDocument, type LessonDocument } from "@edu/shared";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import { NotebookViewer } from "@/components/notebook/NotebookViewer";
import { NotebookEditor } from "@/components/notebook/NotebookEditor";
import type { Lesson, Homework } from "@/lib/types";

interface Comment {
  id: string;
  body: string;
  author: { firstName: string; lastName: string };
  createdAt: string;
  replies?: Comment[];
}

function HomeworkAnswer({ homework }: { homework: Homework }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<LessonDocument>(() => emptyLessonDocument());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/submissions/homework/${homework.id}/submit`, { content: answer });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось отправить ответ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-medium text-slate-800">{homework.title}</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {homework.description && <p className="mt-1 text-sm text-slate-500">{homework.description}</p>}

      {open && (
        <div className="mt-3 space-y-3">
          <NotebookEditor value={answer} onChange={setAnswer} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && <p className="text-sm text-green-700">Ответ отправлен на проверку.</p>}
          <button className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? "Отправка…" : "Отправить на проверку"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudentLessonPage({ params }: { params: { id: string } }) {
  const lesson = useAsync<Lesson>(() => api.get<Lesson>(`/lessons/${params.id}`), [params.id]);
  const comments = useAsync<Comment[]>(
    () => api.get<Comment[]>(`/comments?lessonId=${params.id}`),
    [params.id],
  );

  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const markCompleted = async () => {
    setCompleting(true);
    setCompleteError(null);
    try {
      await api.post(`/lessons/${params.id}/progress`, { status: "COMPLETED" });
      setCompleted(true);
    } catch (err) {
      setCompleteError(err instanceof ApiError ? err.message : "Не удалось отметить урок");
    } finally {
      setCompleting(false);
    }
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setCommentError(null);
    try {
      await api.post("/comments", { body, lessonId: params.id });
      setBody("");
      await comments.reload();
    } catch (err) {
      setCommentError(err instanceof ApiError ? err.message : "Не удалось отправить комментарий");
    } finally {
      setPosting(false);
    }
  };

  const homeworks = lesson.data?.homeworks ?? [];

  return (
    <DashboardShell>
      {lesson.loading && <p className="text-slate-400">Загрузка…</p>}
      {lesson.error && <p className="text-sm text-red-600">{lesson.error}</p>}

      {lesson.data && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-slate-900">{lesson.data.title}</h1>
            <div className="shrink-0 text-right">
              <button className="btn-primary" disabled={completing || completed} onClick={markCompleted}>
                {completed ? "Пройдено" : completing ? "Сохранение…" : "Отметить пройденным"}
              </button>
              {completeError && <p className="mt-1 text-sm text-red-600">{completeError}</p>}
            </div>
          </div>

          <div className="card">
            <NotebookViewer doc={lesson.data.content} />
          </div>

          {homeworks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Домашние задания</h2>
              {homeworks.map((hw) => (
                <HomeworkAnswer key={hw.id} homework={hw} />
              ))}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Комментарии</h2>

            {comments.loading && <p className="text-slate-400">Загрузка комментариев…</p>}
            {comments.error && <p className="text-sm text-red-600">{comments.error}</p>}

            {comments.data && comments.data.length === 0 && (
              <p className="text-slate-400">Пока нет комментариев.</p>
            )}

            {comments.data && comments.data.length > 0 && (
              <ul className="space-y-3">
                {comments.data.map((c) => (
                  <li key={c.id} className="card">
                    <p className="text-sm font-medium text-slate-800">
                      {c.author.firstName} {c.author.lastName}
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {new Date(c.createdAt).toLocaleString("ru")}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                    {c.replies && c.replies.length > 0 && (
                      <ul className="mt-3 space-y-2 border-l-2 border-slate-100 pl-3">
                        {c.replies.map((r) => (
                          <li key={r.id}>
                            <p className="text-sm font-medium text-slate-800">
                              {r.author.firstName} {r.author.lastName}
                              <span className="ml-2 text-xs font-normal text-slate-400">
                                {new Date(r.createdAt).toLocaleString("ru")}
                              </span>
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={postComment} className="card space-y-2">
              <label className="label">Ваш комментарий</label>
              <textarea
                className="input min-h-[80px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Задайте вопрос или оставьте комментарий"
              />
              {commentError && <p className="text-sm text-red-600">{commentError}</p>}
              <button className="btn-primary" disabled={posting || !body.trim()}>
                {posting ? "Отправка…" : "Отправить"}
              </button>
            </form>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
