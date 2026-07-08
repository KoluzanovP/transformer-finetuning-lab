"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { MarkdownMath } from "@/components/MarkdownMath";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { Homework } from "@/lib/types";

interface QuizOption { id: string; text: string; correct?: boolean }
interface QuizBlock { id: string; type: string; question: string; multiple?: boolean; options: QuizOption[]; explanation?: string }

interface CheckResult {
  scorePercent: number;
  correctCount: number;
  total: number;
  results: { blockId: string; correct: boolean; correctOptionIds: string[] }[];
}

export default function HomeworkTestPage({ params }: { params: { id: string } }) {
  const { data: hw, loading } = useAsync(() => api.get<Homework>(`/homework/${params.id}`), [params.id]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quizzes = useMemo<QuizBlock[]>(() => {
    const blocks = (hw?.content?.blocks ?? []) as unknown as QuizBlock[];
    return blocks.filter((b) => b.type === "QUIZ" && Array.isArray(b.options));
  }, [hw]);

  const toggle = (q: QuizBlock, optId: string) => {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.multiple) {
        return { ...prev, [q.id]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
      }
      return { ...prev, [q.id]: [optId] };
    });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<CheckResult>(`/submissions/homework/${params.id}/autocheck`, { answers });
      setResult(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка проверки");
    } finally {
      setBusy(false);
    }
  };

  const resultFor = (blockId: string) => result?.results.find((r) => r.blockId === blockId);

  return (
    <DashboardShell>
      {loading && <p className="text-slate-400">Загрузка…</p>}
      {hw && (
        <div className="max-w-3xl">
          <h1 className="mb-1 text-2xl font-bold">{hw.title}</h1>
          {hw.description && <p className="mb-4 text-slate-500">{hw.description}</p>}

          {result && (
            <div className={`card mb-5 text-center ${result.scorePercent >= 60 ? "border-green-300" : "border-amber-300"}`}>
              <p className="text-sm text-slate-500">Ваш результат</p>
              <p className="text-4xl font-bold text-brand-700">{result.scorePercent}%</p>
              <p className="text-slate-600">Верно {result.correctCount} из {result.total}</p>
            </div>
          )}

          {quizzes.length === 0 && <p className="text-slate-400">В этом задании нет тестовых вопросов.</p>}

          <div className="space-y-4">
            {quizzes.map((q, idx) => {
              const r = resultFor(q.id);
              return (
                <div key={q.id} className={`card ${r ? (r.correct ? "border-green-400" : "border-red-400") : ""}`}>
                  <div className="mb-2 flex items-start gap-2">
                    <span className="font-bold text-slate-400">{idx + 1}.</span>
                    <div className="font-medium [&_p]:my-0"><MarkdownMath>{q.question}</MarkdownMath></div>
                  </div>
                  <div className="space-y-1">
                    {q.options.map((o) => {
                      const chosen = (answers[q.id] ?? []).includes(o.id);
                      const isCorrectAns = r?.correctOptionIds.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          disabled={!!result}
                          onClick={() => toggle(q, o.id)}
                          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                            result
                              ? isCorrectAns
                                ? "border-green-400 bg-green-50"
                                : chosen
                                  ? "border-red-400 bg-red-50"
                                  : "border-slate-200"
                              : chosen
                                ? "border-brand-400 bg-brand-50"
                                : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-slate-400">{q.multiple ? (chosen ? "☑" : "☐") : chosen ? "●" : "○"}</span>
                          <span className="[&_p]:my-0"><MarkdownMath>{o.text}</MarkdownMath></span>
                        </button>
                      );
                    })}
                  </div>
                  {result && q.explanation && (
                    <div className="mt-2 text-sm text-slate-500"><MarkdownMath>{q.explanation}</MarkdownMath></div>
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-5 flex gap-2">
            {!result ? (
              <button className="btn-primary" disabled={busy || quizzes.length === 0} onClick={submit}>
                {busy ? "Проверяю…" : "Проверить и получить балл"}
              </button>
            ) : (
              <button className="btn-ghost" onClick={() => { setResult(null); setAnswers({}); }}>
                Пройти заново
              </button>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
