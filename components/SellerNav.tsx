"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  LayoutDashboard,
  ClipboardPaste,
  FileText,
  LogOut,
  Menu,
  Package,
  Package2,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  shopName: string;
}

const NAV_LINKS = [
  { href: "/seller", label: "홈", icon: LayoutDashboard },
  { href: "/seller/products", label: "상품·공급가", icon: Package },
  { href: "/seller/outbound-sms", label: "안내 문자", icon: Send },
  { href: "/seller/reply", label: "답장 분석", icon: ClipboardPaste },
  { href: "/seller/orders", label: "발주", icon: FileText },
  { href: "/seller/recommend", label: "신상품 추천", icon: Sparkles },
  { href: "/seller/account", label: "내 계정", icon: User },
] as const;

function linkActive(pathname: string, href: string): boolean {
  if (href === "/seller/reply") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (href === "/seller/orders") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href;
}

export default function SellerNav({ shopName }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/seller/login");
    router.refresh();
  };

  const linkClass = (href: string, compact = false) => {
    const active = linkActive(pathname, href);
    return `flex items-center gap-2 rounded-lg font-medium transition ${
      compact ? "px-3 py-2.5 text-sm" : "px-3 py-2 text-sm"
    } ${
      active
        ? "bg-emerald-50 text-emerald-700"
        : "text-slate-600 hover:bg-slate-100"
    }`;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
            <Package2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">셀틱</h1>
            <p className="truncate text-xs text-slate-500">{shopName}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={linkClass(href)}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 sm:hidden"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
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
            className="fixed inset-0 z-30 bg-slate-900/20 sm:hidden"
            aria-label="메뉴 닫기"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="relative z-40 border-t border-slate-200 bg-white px-4 py-2 sm:hidden">
            <div className="flex flex-col gap-0.5">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={linkClass(href, true)}
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
