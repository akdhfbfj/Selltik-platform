"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import AdminOrderStatsPanel from "@/components/AdminOrderStatsPanel";
import type { AdminOrderStats } from "@/lib/admin-order-stats";
import { currentMonthRange } from "@/lib/date-range";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Inbox,
  Package,
  Users,
} from "lucide-react";

const shortcuts = [
  {
    href: "/",
    label: "업체 컨택",
    desc: "신규 업체·진행 관리",
    icon: Building2,
    color: "border-slate-200 hover:border-brand-200",
  },
  {
    href: "/inbox",
    label: "셀러 추천함",
    desc: "신상품 제안 검토",
    icon: Inbox,
    color: "border-slate-200 hover:border-emerald-200",
  },
  {
    href: "/admin/orders",
    label: "발주 현황",
    desc: "셀러별 발주·매출",
    icon: ArrowRight,
    color: "border-slate-200 hover:border-blue-200",
  },
  {
    href: "/admin/shops",
    label: "셀러 계정",
    desc: "계정·비밀번호",
    icon: Users,
    color: "border-slate-200 hover:border-amber-200",
  },
  {
    href: "/admin/products",
    label: "공급가",
    desc: "상품·CSV 반영",
    icon: Package,
    color: "border-slate-200 hover:border-violet-200",
  },
];

export default function AdminHomePage() {
  const [stats, setStats] = useState<AdminOrderStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    const { from, to } = currentMonthRange();
    const res = await fetch(
      `/api/admin/orders/stats?from=${from}&to=${to}`
    );
    if (res.ok) {
      setStats(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">관리자 홈</h2>
          <p className="mt-1 text-sm text-slate-500">
            셀틱 발주·셀러·업체를 한곳에서 확인합니다.
          </p>
        </div>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <AdminOrderStatsPanel stats={stats} loading={loading} />
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">바로가기</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shortcuts.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={`flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition ${s.color}`}
              >
                <s.icon className="h-5 w-5 shrink-0 text-slate-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{s.label}</p>
                  <p className="text-xs text-slate-500">{s.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
