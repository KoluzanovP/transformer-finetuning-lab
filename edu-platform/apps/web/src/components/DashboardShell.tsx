"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Role, ROLE_LABELS_RU } from "@edu/shared";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "./NotificationBell";

interface NavItem {
  href: string;
  label: string;
  role: Role;
}

const NAV: NavItem[] = [
  { href: "/author", label: "Обзор", role: Role.AUTHOR },
  { href: "/author/courses", label: "Курсы", role: Role.AUTHOR },
  { href: "/author/users", label: "Пользователи", role: Role.AUTHOR },
  { href: "/author/schedule", label: "Расписание", role: Role.AUTHOR },
  { href: "/author/audit", label: "Лог действий", role: Role.AUTHOR },
  { href: "/teacher", label: "Проверка ДЗ", role: Role.TEACHER },
  { href: "/teacher/students", label: "Мои ученики", role: Role.TEACHER },
  { href: "/teacher/calls", label: "Созвоны", role: Role.TEACHER },
  { href: "/mentor", label: "Тикеты", role: Role.MENTOR },
  { href: "/student", label: "Мои курсы", role: Role.STUDENT },
  { href: "/student/calls", label: "Созвоны", role: Role.STUDENT },
  { href: "/student/support", label: "Поддержка", role: Role.STUDENT },
  { href: "/parent", label: "Мои дети", role: Role.PARENT },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-slate-400">Загрузка…</div>;
  }

  const items = NAV.filter((n) => user.roles.includes(n.role));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-brand-700">EduPlatform</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {user.firstName} {user.lastName}
            </span>
            <span className="flex gap-1">
              {user.roles.map((r) => (
                <span key={r} className="badge bg-brand-50 text-brand-700">{ROLE_LABELS_RU[r]}</span>
              ))}
            </span>
            <NotificationBell />
            <button className="btn-ghost !py-1" onClick={() => logout().then(() => router.replace("/login"))}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="w-56 shrink-0">
          <nav className="space-y-1">
            {items.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
