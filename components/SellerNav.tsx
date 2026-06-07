"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Package2,
  Sparkles,
} from "lucide-react";

interface Props {
  shopName: string;
}

export default function SellerNav({ shopName }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/seller/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
            <Package2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{shopName}</h1>
            <p className="text-xs text-slate-500">셀러 포털</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/seller"
            className={`hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium sm:flex ${
              pathname === "/seller"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            홈
          </Link>
          <Link
            href="/seller/products"
            className={`hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium sm:flex ${
              pathname === "/seller/products"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Package className="h-4 w-4" />
            상품·공급가
          </Link>
          <Link
            href="/seller/orders"
            className={`hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium sm:flex ${
              pathname === "/seller/orders"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            문자→발주
          </Link>
          <Link
            href="/seller/recommend"
            className={`hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium sm:flex ${
              pathname === "/seller/recommend"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            신상품 추천
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </div>
    </header>
  );
}
