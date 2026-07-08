"use client";

import { ROLE_LABELS_RU, type Role } from "@edu/shared";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";

interface Overview {
  users: number;
  usersByRole: Record<string, number>;
  courses: number;
  activeEnrollments: number;
  pendingSubmissions: number;
  upcomingCalls: number;
}

const STATS: { key: keyof Omit<Overview, "usersByRole">; label: string }[] = [
  { key: "users", label: "Всего пользователей" },
  { key: "courses", label: "Курсы" },
  { key: "activeEnrollments", label: "Активные зачисления" },
  { key: "pendingSubmissions", label: "ДЗ на проверке" },
  { key: "upcomingCalls", label: "Предстоящие созвоны" },
];

export default function AuthorOverviewPage() {
  const { data, loading, error } = useAsync<Overview>(() => api.get<Overview>("/analytics/overview"), []);

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Обзор</h1>

      {loading && <p className="text-slate-400">Загрузка…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {STATS.map((s) => (
              <div key={s.key} className="card">
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className="mt-2 text-3xl font-bold text-brand-700">{data[s.key]}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Пользователи по ролям</h2>
            <div className="flex flex-wrap gap-4">
              {Object.entries(data.usersByRole).map(([role, count]) => (
                <div key={role} className="flex items-center gap-2">
                  <span className="badge bg-brand-50 text-brand-700">
                    {ROLE_LABELS_RU[role as Role] ?? role}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
