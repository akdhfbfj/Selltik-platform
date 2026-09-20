"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ADMIN_API,
  fetchAdminApi,
  peekAdminApiData,
  prefetchAdminTab,
} from "@/lib/admin-api-cache";
import {
  BarChart3,
  Building2,
  ClipboardList,
  Home,
  Inbox,
  LogOut,
  Menu,
  MessagesSquare,
  Package,
  Package2,
  Users,
  X,
} from "lucide-react";

function navActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const LINKS = [
  { href: "/admin", label: "홈", icon: Home },
  { href: "/admin/board", label: "업무·문의", icon: MessagesSquare },
  { href: "/admin/products", label: "공급가", icon: Package },
  { href: "/admin/orders", label: "발주 현황", icon: ClipboardList },
  { href: "/admin/finance", label: "자금 흐름", icon: BarChart3 },
  { href: "/inbox", label: "셀러 추천함", icon: Inbox },
  { href: "/", label: "업체 컨택", icon: Building2 },
  { href: "/admin/shops", label: "셀러 계정", icon: Users },
] as const;

export default function AdminNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState(
    () => peekAdminApiData<{ name: string }>(ADMIN_API.me)?.name || "관리자"
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetchAdminApi<{ name: string }>(ADMIN_API.me).then((res) => {
      if (res.ok && res.data?.name) setAdminName(res.data.name);
    });
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const linkClass = (href: string, compact = false) => {
    const active = navActive(pathname, href);
    return `flex items-center gap-2 rounded-lg font-medium transition ${
      compact ? "px-3 py-2.5 text-sm" : "px-3 py-2 text-sm"
    } ${
      active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
    }`;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
            <Package2 className="h-5 w-5" />
          </div>
          <Link href="/admin" className="group min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900 group-hover:text-brand-700">
              셀틱 관리
            </h1>
            <p className="text-xs text-slate-500">{adminName}</p>
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav className="hidden items-center gap-1 lg:flex">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={linkClass(href)}
                onPointerEnter={() => prefetchAdminTab(href)}
                onFocus={() => prefetchAdminTab(href)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:px-3"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden"
            aria-label="메뉴 닫기"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="relative z-40 border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
            <div className="flex flex-col gap-0.5">
              {LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={linkClass(href, true)}
                  onPointerEnter={() => prefetchAdminTab(href)}
                  onFocus={() => prefetchAdminTab(href)}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
