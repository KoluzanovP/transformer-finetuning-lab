"use client";

import { useState } from "react";
import { ROLE_LABELS_RU, type Role } from "@edu/shared";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";

interface AuditItem {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actor: { firstName: string; lastName: string; roles: Role[] } | null;
}

interface AuditResponse {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

export default function AuthorAuditPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync<AuditResponse>(
    () => api.get<AuditResponse>(`/analytics/audit?page=${page}&pageSize=${PAGE_SIZE}`),
    [page],
  );

  const total = data?.total ?? 0;
  const hasNext = page * PAGE_SIZE < total;

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Лог действий</h1>

      {loading && <p className="text-slate-400">Загрузка…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Время</th>
                  <th className="py-2 pr-4">Кто</th>
                  <th className="py-2 pr-4">Действие</th>
                  <th className="py-2">Объект</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-500">{new Date(it.createdAt).toLocaleString("ru")}</td>
                    <td className="py-2 pr-4 text-slate-800">
                      {it.actor
                        ? `${it.actor.firstName} ${it.actor.lastName} (${it.actor.roles.map((r) => ROLE_LABELS_RU[r] ?? r).join(", ")})`
                        : "система"}
                    </td>
                    <td className="py-2 pr-4 text-slate-800">{it.action}</td>
                    <td className="py-2 text-slate-500">{it.entityType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.items.length === 0 && <p className="mt-3 text-sm text-slate-500">Записей нет.</p>}

          <div className="mt-4 flex items-center justify-between">
            <button className="btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ← Назад
            </button>
            <span className="text-sm text-slate-500">Страница {page}</span>
            <button className="btn-ghost" disabled={!hasNext || loading} onClick={() => setPage((p) => p + 1)}>
              Вперёд →
            </button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
