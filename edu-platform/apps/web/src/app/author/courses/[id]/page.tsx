"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { Course, Lesson, Homework, Enrollment, UserRow } from "@/lib/types";

export default function Page({ params }: { params: { id: string } }) {
  const { id } = params;
  const course = useAsync<Course>(() => api.get<Course>(`/courses/${id}`), [id]);
  const students = useAsync<UserRow[]>(() => api.get<UserRow[]>("/users?role=STUDENT"), []);
  const teachers = useAsync<UserRow[]>(() => api.get<UserRow[]>("/users?role=TEACHER"), []);
  const enrollments = useAsync<Enrollment[]>(
    () => api.get<Enrollment[]>(`/enrollments/course/${id}`),
    [id],
  );

  return (
    <DashboardShell>
      {course.loading && <p className="text-slate-400">Загрузка…</p>}
      {course.error && <p className="text-sm text-red-600">{course.error}</p>}

      {course.data && (
        <div className="space-y-6">
          <div>
            <Link href="/author/courses" className="text-sm text-brand-600 hover:underline">← К списку курсов</Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{course.data.title}</h1>
            {course.data.description && <p className="mt-1 text-slate-500">{course.data.description}</p>}
          </div>

          <LessonsSection courseId={id} lessons={course.data.lessons ?? []} onChange={course.reload} />

          <HomeworkSection
            courseId={id}
            homeworks={course.data.homeworks ?? []}
            lessons={course.data.lessons ?? []}
            onChange={course.reload}
          />

          <EnrollmentSection
            courseId={id}
            students={students.data ?? []}
            teachers={teachers.data ?? []}
            enrollments={enrollments.data ?? []}
            loading={enrollments.loading}
            onChange={enrollments.reload}
          />
        </div>
      )}
    </DashboardShell>
  );
}

function LessonsSection({
  courseId,
  lessons,
  onChange,
}: {
  courseId: string;
  lessons: Lesson[];
  onChange: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post<Lesson>(`/courses/${courseId}/lessons`, { title });
      setTitle("");
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить урок");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Уроки</h2>
      {lessons.length === 0 && <p className="text-sm text-slate-500">Пока нет уроков.</p>}
      <ul className="space-y-2">
        {lessons.map((l) => (
          <li key={l.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <Link href={`/author/courses/${courseId}/lessons/${l.id}`} className="text-brand-700 hover:underline">
              {l.title}
            </Link>
            <span className={`badge ${l.isPublished ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
              {l.isPublished ? "Опубликован" : "Черновик"}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название урока" required />
        <button className="btn-primary shrink-0" disabled={busy}>{busy ? "…" : "Добавить"}</button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function HomeworkSection({
  courseId,
  homeworks,
  lessons,
  onChange,
}: {
  courseId: string;
  homeworks: Homework[];
  lessons: Lesson[];
  onChange: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post<Homework>(`/courses/${courseId}/homework`, {
        title,
        description: description || undefined,
        lessonId: lessonId || undefined,
        maxScore,
      });
      setTitle("");
      setDescription("");
      setLessonId("");
      setMaxScore(100);
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить задание");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Домашние задания</h2>
      {homeworks.length === 0 && <p className="text-sm text-slate-500">Пока нет заданий.</p>}
      <ul className="space-y-2">
        {homeworks.map((h) => (
          <li key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-slate-800">{h.title}</span>
            <span className="badge bg-slate-100 text-slate-500">макс. {h.maxScore}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="space-y-3">
        <div>
          <label className="label">Название</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea className="input min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="label">Урок (необязательно)</label>
            <select className="input w-56" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              <option value="">— не привязан —</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Максимальный балл</label>
            <input
              className="input w-32"
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value))}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? "…" : "Добавить задание"}</button>
      </form>
    </div>
  );
}

function EnrollmentSection({
  courseId,
  students,
  teachers,
  enrollments,
  loading,
  onChange,
}: {
  courseId: string;
  students: UserRow[];
  teachers: UserRow[];
  enrollments: Enrollment[];
  loading: boolean;
  onChange: () => Promise<void>;
}) {
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post<Enrollment>("/enrollments", {
        courseId,
        studentId,
        teacherId: teacherId || undefined,
      });
      setStudentId("");
      setTeacherId("");
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось зачислить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Зачисления</h2>

      <form onSubmit={enroll} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Ученик</label>
          <select className="input w-56" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            <option value="">— выберите —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Учитель</label>
          <select className="input w-56" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— без учителя —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary shrink-0" disabled={busy}>{busy ? "…" : "Зачислить"}</button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && <p className="text-slate-400">Загрузка…</p>}
      {!loading && enrollments.length === 0 && <p className="text-sm text-slate-500">Пока нет зачислений.</p>}
      <ul className="space-y-2">
        {enrollments.map((en) => (
          <li key={en.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <span className="text-slate-800">
              {en.student ? `${en.student.firstName} ${en.student.lastName}` : en.studentId}
            </span>
            <span className="text-slate-500">
              {en.teacher ? `Учитель: ${en.teacher.firstName} ${en.teacher.lastName}` : "Без учителя"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
