"use client";

import { useState } from "react";
import { ALL_ROLES, ROLE_LABELS_RU, Role } from "@edu/shared";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { DashboardShell } from "@/components/DashboardShell";
import type { UserRow } from "@/lib/types";

export default function AuthorUsersPage() {
  const { data, loading, error, reload } = useAsync<UserRow[]>(() => api.get<UserRow[]>("/users"), []);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Role[]>([Role.STUDENT]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const toggleRole = (role: Role) =>
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await api.post<UserRow>("/users", {
        email,
        password: password || undefined,
        firstName,
        lastName,
        roles,
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setRoles([Role.STUDENT]);
      await reload();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Не удалось создать пользователя");
    } finally {
      setCreating(false);
    }
  };

  const parents = (data ?? []).filter((u) => u.roles.includes(Role.PARENT));
  const students = (data ?? []).filter((u) => u.roles.includes(Role.STUDENT));

  return (
    <DashboardShell>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Пользователи</h1>

      <form onSubmit={createUser} className="card mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Новый пользователь</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Имя</label>
            <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Фамилия</label>
            <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="необязательно" />
          </div>
        </div>
        <div>
          <label className="label">Роли</label>
          <div className="flex flex-wrap gap-3">
            {ALL_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} />
                {ROLE_LABELS_RU[r]}
              </label>
            ))}
          </div>
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
        <button className="btn-primary" disabled={creating}>{creating ? "Создание…" : "Создать"}</button>
      </form>

      <LinkParentSection parents={parents} students={students} />

      <div className="card mt-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Все пользователи</h2>
        {loading && <p className="text-slate-400">Загрузка…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Имя</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2">Роли</th>
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-800">{u.firstName} {u.lastName}</td>
                    <td className="py-2 pr-4 text-slate-500">{u.email}</td>
                    <td className="py-2">
                      <span className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span key={r} className="badge bg-brand-50 text-brand-700">{ROLE_LABELS_RU[r]}</span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function LinkParentSection({ parents, students }: { parents: UserRow[]; students: UserRow[] }) {
  const [parentId, setParentId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const link = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await api.post("/users/link-parent", { parentId, studentId });
      setMessage("Связь создана");
      setParentId("");
      setStudentId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось связать");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={link} className="card space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Связать родителя и ученика</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Родитель</label>
          <select className="input w-56" value={parentId} onChange={(e) => setParentId(e.target.value)} required>
            <option value="">— выберите —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ученик</label>
          <select className="input w-56" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            <option value="">— выберите —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary shrink-0" disabled={busy}>{busy ? "…" : "Связать"}</button>
      </div>
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
