"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import AdminOrderStatsPanel from "@/components/AdminOrderStatsPanel";
import type { AdminOrderStats } from "@/lib/admin-order-stats";
import { currentMonthRange } from "@/lib/date-range";

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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <AdminOrderStatsPanel stats={stats} loading={loading} />
        </section>
      </main>
    </div>
  );
}
