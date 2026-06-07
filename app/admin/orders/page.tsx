"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import AdminOrderStatsPanel from "@/components/AdminOrderStatsPanel";
import type { AdminOrderRow, AdminOrderStats } from "@/lib/admin-order-stats";
import { currentMonthRange } from "@/lib/date-range";
import { formatKrw } from "@/lib/parse-supply-csv";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import type { Shop } from "@/lib/types";
import { Loader2 } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  exported: "bg-blue-100 text-blue-800",
  confirmed: "bg-slate-100 text-slate-600",
};

export default function AdminOrdersPage() {
  const defaults = currentMonthRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [shopId, setShopId] = useState("");
  const [shops, setShops] = useState<Shop[]>([]);
  const [stats, setStats] = useState<AdminOrderStats | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/shops")
      .then((r) => r.json())
      .then((d) => setShops(d.shops ?? []));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (shopId) params.set("shopId", shopId);

    const [statsRes, ordersRes] = await Promise.all([
      fetch(`/api/admin/orders/stats?${params}`),
      fetch(`/api/admin/orders?${params}`),
    ]);

    if (statsRes.ok) setStats(await statsRes.json());
    if (ordersRes.ok) {
      const data = await ordersRes.json();
      setOrders(data.orders ?? []);
    }
    setLoading(false);
  }, [from, to, shopId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">발주 현황</h2>
          <p className="mt-1 text-sm text-slate-500">
            셀러별 발주·셀틱 입금·순이익 추정 (입금확인·다운로드 완료 건 기준
            집계)
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              시작일
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              종료일
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              셀러
            </label>
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <AdminOrderStatsPanel stats={stats} loading={loading} compact />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-slate-800">
              발주 목록 ({orders.length}건)
            </h4>
            <p className="text-xs text-slate-500">
              개인정보·상세 주소는 생략하고 금액·상태 위주로 표시합니다.
            </p>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : orders.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              해당 기간 발주가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2 font-medium">발주일</th>
                    <th className="px-4 py-2 font-medium">셀러</th>
                    <th className="px-4 py-2 font-medium">상품</th>
                    <th className="px-4 py-2 font-medium text-right">수량</th>
                    <th className="px-4 py-2 font-medium">상태</th>
                    <th className="px-4 py-2 font-medium text-right">
                      셀틱 입금
                    </th>
                    <th className="px-4 py-2 font-medium text-right">
                      순이익 추정
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-600">
                        {o.orderDate.replace(/-/g, ".")}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {o.shopName}
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-2.5 text-slate-700">
                        {o.productName}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">
                        {o.quantity}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[o.status] ?? ""}`}
                        >
                          {ORDER_STATUS_LABELS[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-emerald-700">
                        {formatKrw(o.celticDeposit)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {o.customerSales > 0
                          ? formatKrw(o.sellerMargin)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
