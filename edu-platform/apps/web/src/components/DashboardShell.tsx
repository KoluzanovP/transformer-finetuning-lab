"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Закрывать мобильное меню при переходе.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-slate-400">Загрузка…</div>;
  }

  const items = NAV.filter((n) => user.roles.includes(n.role));

  const navLinks = (
    <nav className="space-y-1">
      {items.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`block rounded-lg px-3 py-2.5 text-sm ${
              active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Меню"
            >
              <span className="block h-0.5 w-5 bg-current" />
              <span className="mt-1 block h-0.5 w-5 bg-current" />
              <span className="mt-1 block h-0.5 w-5 bg-current" />
            </button>
            <Link href="/" className="text-lg font-bold text-brand-700">EduPlatform</Link>
          </div>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            <span className="hidden text-slate-500 sm:inline">
              {user.firstName} {user.lastName}
            </span>
            <span className="hidden gap-1 lg:flex">
              {user.roles.map((r) => (
                <span key={r} className="badge bg-brand-50 text-brand-700">{ROLE_LABELS_RU[r]}</span>
              ))}
            </span>
            <NotificationBell />
            <button className="btn-ghost !px-2 !py-1" onClick={() => logout().then(() => router.replace("/login"))}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Мобильное выезжающее меню */}
      {menuOpen && (
        <div className="fixed inset-0 z-20 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <aside
            className="absolute left-0 top-0 h-full w-64 max-w-[80%] overflow-y-auto bg-white p-4 pt-20 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {navLinks}
          </aside>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-5 sm:px-4 sm:py-6">
        <aside className="hidden w-56 shrink-0 md:block">{navLinks}</aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
