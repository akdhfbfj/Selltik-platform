"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Inbox, LogOut, Package2, Users } from "lucide-react";

export default function AdminNav() {
  const pathname = usePathname();

  const links = [
    { href: "/inbox", label: "셀러 추천함", icon: Inbox },
    { href: "/", label: "업체 컨택", icon: Building2 },
    { href: "/admin/shops", label: "셀러 계정", icon: Users },
  ];

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
              <Package2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">신상품 관리</h1>
              <p className="text-xs text-slate-500">셀틱 전용</p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">로그아웃</span>
        </button>
      </div>
      <nav className="flex gap-1 border-t border-slate-100 px-4 py-2 sm:hidden">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium ${
                active ? "bg-brand-50 text-brand-700" : "text-slate-600"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
