"use client";

import { useEffect, useState } from "react";
import { ROLE_LABELS_RU } from "@edu/shared";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { UserRow } from "@/lib/types";

interface AvailabilityRule {
  id?: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
}

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function AuthorSchedulePage() {
  const teachers = useAsync<UserRow[]>(() => api.get<UserRow[]>("/users?role=TEACHER"), []);
  const mentors = useAsync<UserRow[]>(() => api.get<UserRow[]>("/users?role=MENTOR"), []);

  const [staffId, setStaffId] = useState("");
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!staffId) {
      setRules([]);
      return;
    }
    let active = true;
    setLoadingRules(true);
    setError(null);
    setSaved(false);
    api
      .get<{ rules: AvailabilityRule[] }>(`/staff/${staffId}/availability`)
      .then((res) => {
        if (active) setRules(res.rules ?? []);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : "Не удалось загрузить расписание");
      })
      .finally(() => {
        if (active) setLoadingRules(false);
      });
    return () => {
      active = false;
    };
  }, [staffId]);

  const updateRule = (index: number, changes: Partial<AvailabilityRule>) => {
    setSaved(false);
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...changes } : r)));
  };

  const addRule = () => {
    setSaved(false);
    setRules((prev) => [...prev, { weekday: 1, startMinute: 9 * 60, endMinute: 18 * 60 }]);
  };

  const removeRule = (index: number) => {
    setSaved(false);
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.put(`/staff/${staffId}/availability`, {
        rules: rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute })),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const staff = [
    ...(teachers.data ?? []).map((u) => ({ user: u, role: "TEACHER" as const })),
    ...(mentors.data ?? []).map((u) => ({ user: u, role: "MENTOR" as const })),
  ];

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Расписание</h1>

      <div className="card mb-6">
        <label className="label">Сотрудник</label>
        <select className="input w-72" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">— выберите —</option>
          {staff.map(({ user, role }) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName} · {ROLE_LABELS_RU[role]}
            </option>
          ))}
        </select>
      </div>

      {staffId && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Доступность</h2>
          {loadingRules && <p className="text-slate-400">Загрузка…</p>}

          {!loadingRules && rules.length === 0 && <p className="text-sm text-slate-500">Нет правил.</p>}

          <div className="space-y-2">
            {rules.map((rule, i) => (
              <div key={rule.id ?? i} className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="label">День</label>
                  <select
                    className="input w-24"
                    value={rule.weekday}
                    onChange={(e) => updateRule(i, { weekday: Number(e.target.value) })}
                  >
                    {WEEKDAYS.map((w, idx) => (
                      <option key={idx} value={idx}>{w}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">С</label>
                  <input
                    className="input w-32"
                    type="time"
                    value={toTime(rule.startMinute)}
                    onChange={(e) => updateRule(i, { startMinute: toMinutes(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">До</label>
                  <input
                    className="input w-32"
                    type="time"
                    value={toTime(rule.endMinute)}
                    onChange={(e) => updateRule(i, { endMinute: toMinutes(e.target.value) })}
                  />
                </div>
                <button className="btn-ghost !py-2" onClick={() => removeRule(i)}>Удалить</button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-ghost" onClick={addRule}>+ Правило</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
            {saved && <span className="text-sm text-green-600">Сохранено ✓</span>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </DashboardShell>
  );
}
