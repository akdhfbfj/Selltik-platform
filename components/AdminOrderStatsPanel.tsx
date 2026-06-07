"use client";

import { formatKrw } from "@/lib/parse-supply-csv";
import type { AdminOrderStats } from "@/lib/admin-order-stats";
import {
  ArrowRight,
  Banknote,
  ClipboardList,
  Loader2,
  Store,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

interface Props {
  stats: AdminOrderStats | null;
  loading?: boolean;
  compact?: boolean;
}

export default function AdminOrderStatsPanel({
  stats,
  loading,
  compact = false,
}: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!stats) return null;

  const periodLabel = `${stats.from.replace(/-/g, ".")} ~ ${stats.to.replace(/-/g, ".")}`;

  const cards = [
    {
      label: "발주 확정",
      sub: "입금확인·다운로드 완료",
      value: `${stats.totals.confirmedCount}건`,
      icon: ClipboardList,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "셀틱 입금",
      sub: "공급가 합계",
      value: formatKrw(stats.totals.celticDepositTotal),
      icon: Banknote,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "판매 추정",
      sub: "셀러 고객 판매가",
      value: formatKrw(stats.totals.customerSalesTotal),
      icon: Store,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "셀러 순이익 추정",
      sub: "판매 − 셀틱 입금",
      value: formatKrw(stats.totals.sellerMarginTotal),
      icon: TrendingUp,
      color: "text-amber-600 bg-amber-50",
    },
  ];

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3
            className={`font-bold text-slate-900 ${compact ? "text-base" : "text-lg"}`}
          >
            셀러 발주 요약
          </h3>
          <p className="text-xs text-slate-500">
            발주일 기준 · {periodLabel}
            {stats.totals.draftCount > 0 &&
              ` · 입금대기 ${stats.totals.draftCount}건 제외`}
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          발주 현황 보기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div
        className={`grid gap-3 ${compact ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-4"}`}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className={`rounded-lg p-2 ${c.color}`}>
                <c.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{c.label}</p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">
                  {c.value}
                </p>
                <p className="text-[11px] text-slate-400">{c.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!compact && stats.byShop.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-slate-800">셀러별</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">셀러</th>
                  <th className="px-4 py-2 font-medium text-right">확정</th>
                  <th className="px-4 py-2 font-medium text-right">셀틱 입금</th>
                  <th className="px-4 py-2 font-medium text-right">순이익 추정</th>
                  <th className="px-4 py-2 font-medium">최근 발주</th>
                </tr>
              </thead>
              <tbody>
                {stats.byShop.map((s) => (
                  <tr key={s.shopId} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {s.shopName}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {s.confirmedCount}건
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-700">
                      {formatKrw(s.celticDepositTotal)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">
                      {formatKrw(s.sellerMarginTotal)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {s.lastOrderDate?.replace(/-/g, ".") ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {compact && stats.byShop.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.byShop.slice(0, 4).map((s) => (
            <span
              key={s.shopId}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
            >
              {s.shopName} {s.confirmedCount}건 · {formatKrw(s.celticDepositTotal)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
