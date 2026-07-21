"use client";

import { useMemo, useState } from "react";
import type {
  SellerOrderDailyMetric,
  SellerOrderPeriodMetric,
  SellerOrderRevenueTrends,
} from "@/lib/types";
import { formatKrw } from "@/lib/parse-supply-csv";
import { TrendingUp } from "lucide-react";

type ViewMode = "cumulative" | "daily" | "weekly" | "monthly";

interface Props {
  data: SellerOrderDailyMetric[];
  trends?: SellerOrderRevenueTrends;
  monthLabel: string;
}

const W = 320;
const H = 88;
const PAD = { top: 8, right: 8, bottom: 22, left: 36 };

const VIEW_TABS: { id: ViewMode; label: string }[] = [
  { id: "cumulative", label: "누적" },
  { id: "daily", label: "일" },
  { id: "weekly", label: "주" },
  { id: "monthly", label: "월" },
];

function toPoints(
  data: SellerOrderDailyMetric[],
  key: "cumulativeSales" | "cumulativeMargin",
  maxY: number
): string {
  if (data.length === 0 || maxY <= 0) return "";
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  return data
    .map((d, i) => {
      const x = PAD.left + (i / Math.max(data.length - 1, 1)) * innerW;
      const y = PAD.top + innerH - (d[key] / maxY) * innerH;
      return `${x},${y}`;
    })
    .join(" ");
}

function toArea(
  data: SellerOrderDailyMetric[],
  key: "cumulativeSales" | "cumulativeMargin",
  maxY: number
): string {
  const line = toPoints(data, key, maxY);
  if (!line) return "";
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const baseY = PAD.top + innerH;
  return `${PAD.left},${baseY} ${line} ${PAD.left + innerW},${baseY}`;
}

function formatAxisY(n: number): string {
  if (n >= 10000) return `${Math.round(n / 10000)}만`;
  if (n >= 1000) return `${Math.round(n / 1000)}천`;
  return String(n);
}

function sumPeriod(
  series: SellerOrderPeriodMetric[],
  key: "sales" | "margin"
): number {
  return series.reduce((s, p) => s + p[key], 0);
}

function CumulativeMiniChart({
  title,
  total,
  data,
  valueKey,
  stroke,
  gradientId,
  emptyHint,
}: {
  title: string;
  total: number;
  data: SellerOrderDailyMetric[];
  valueKey: "cumulativeSales" | "cumulativeMargin";
  stroke: string;
  gradientId: string;
  emptyHint?: string;
}) {
  const maxY = Math.max(total, 1);
  const line = toPoints(data, valueKey, maxY);
  const area = toArea(data, valueKey, maxY);
  const hasData = total > 0;
  const yTicks = [0, maxY];

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-slate-600">{title}</span>
        <span className="text-xs font-bold" style={{ color: stroke }}>
          {formatKrw(total)}
        </span>
      </div>
      <div className="relative h-[88px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title} 누적 그래프`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {yTicks.map((tick) => {
            const innerH = H - PAD.top - PAD.bottom;
            const y = PAD.top + innerH - (tick / maxY) * innerH;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={W - PAD.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="2 2"
                />
                <text
                  x={PAD.left - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[8px]"
                >
                  {formatAxisY(tick)}
                </text>
              </g>
            );
          })}
          {hasData && area && (
            <polygon points={area} fill={`url(#${gradientId})`} />
          )}
          {hasData && line && (
            <polyline
              points={line}
              fill="none"
              stroke={stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        {!hasData && emptyHint && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-[9px] text-slate-400">{emptyHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PeriodBarChart({
  title,
  total,
  series,
  valueKey,
  stroke,
  emptyHint,
  denseLabels,
}: {
  title: string;
  total: number;
  series: SellerOrderPeriodMetric[];
  valueKey: "sales" | "margin";
  stroke: string;
  emptyHint?: string;
  denseLabels?: boolean;
}) {
  const maxY = Math.max(...series.map((p) => p[valueKey]), 1);
  const hasData = total > 0;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = Math.max(series.length, 1);
  const gap = denseLabels ? 1.5 : 2.5;
  const barW = Math.max((innerW - gap * (n + 1)) / n, 2);
  const labelEvery =
    series.length > 10 ? 3 : series.length > 7 ? 2 : 1;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-slate-600">{title}</span>
        <span className="text-xs font-bold" style={{ color: stroke }}>
          {formatKrw(total)}
        </span>
      </div>
      <div className="relative h-[88px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title} 기간별 그래프`}
        >
          {[0, maxY].map((tick) => {
            const y = PAD.top + innerH - (tick / maxY) * innerH;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={W - PAD.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="2 2"
                />
                <text
                  x={PAD.left - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[8px]"
                >
                  {formatAxisY(tick)}
                </text>
              </g>
            );
          })}
          {series.map((p, i) => {
            const value = p[valueKey];
            const h = (value / maxY) * innerH;
            const x = PAD.left + gap + i * (barW + gap);
            const y = PAD.top + innerH - h;
            const showLabel = i % labelEvery === 0 || i === series.length - 1;
            return (
              <g key={p.key}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(h, value > 0 ? 1.5 : 0)}
                  rx={1.5}
                  fill={stroke}
                  opacity={value > 0 ? 0.85 : 0.15}
                />
                {showLabel && (
                  <text
                    x={x + barW / 2}
                    y={H - 4}
                    textAnchor="middle"
                    className="fill-slate-400 text-[7px]"
                  >
                    {denseLabels
                      ? p.label.replace(/^(\d+)\/(\d+)$/, "$2")
                      : p.label.length > 8
                        ? p.label.replace(/^\d{4}년 /, "")
                        : p.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {!hasData && emptyHint && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-[9px] text-slate-400">{emptyHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function viewCopy(
  mode: ViewMode,
  monthLabel: string
): { title: string; subtitle: string; salesTitle: string; marginTitle: string } {
  switch (mode) {
    case "daily":
      return {
        title: "일별 매출",
        subtitle: "최근 14일 · 그날 발주 확정분",
        salesTitle: "일별 판매",
        marginTitle: "일별 마진",
      };
    case "weekly":
      return {
        title: "주별 매출",
        subtitle: "최근 8주 · 주간 발주 확정 합계",
        salesTitle: "주간 판매",
        marginTitle: "주간 마진",
      };
    case "monthly":
      return {
        title: "월별 매출",
        subtitle: "최근 6개월 · 월간 발주 확정 합계",
        salesTitle: "월간 판매",
        marginTitle: "월간 마진",
      };
    default:
      return {
        title: `${monthLabel} 매출 추이`,
        subtitle: "발주 확정 기준 누적 · 위로 갈수록 성장",
        salesTitle: "누적 판매",
        marginTitle: "누적 마진",
      };
  }
}

export default function SellerRevenueChart({
  data,
  trends,
  monthLabel,
}: Props) {
  const [view, setView] = useState<ViewMode>("cumulative");
  const copy = viewCopy(view, monthLabel);

  const periodSeries = useMemo(() => {
    if (!trends) return [] as SellerOrderPeriodMetric[];
    if (view === "daily") return trends.daily;
    if (view === "weekly") return trends.weekly;
    if (view === "monthly") return trends.monthly;
    return [];
  }, [trends, view]);

  const last = data[data.length - 1];
  const cumulativeSales = last?.cumulativeSales ?? 0;
  const cumulativeMargin = last?.cumulativeMargin ?? 0;

  const periodSales =
    view === "cumulative" ? cumulativeSales : sumPeriod(periodSeries, "sales");
  const periodMargin =
    view === "cumulative" ? cumulativeMargin : sumPeriod(periodSeries, "margin");
  const hasData = periodSales > 0 || periodMargin > 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white/70 p-4">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="truncate">{copy.title}</span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">{copy.subtitle}</p>
          </div>
          <div
            className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
            aria-label="매출 추이 단위"
          >
            {VIEW_TABS.map((tab) => {
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(tab.id)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {view === "cumulative" ? (
          <>
            <CumulativeMiniChart
              title={copy.salesTitle}
              total={cumulativeSales}
              data={data}
              valueKey="cumulativeSales"
              stroke="#7c3aed"
              gradientId="salesGradient"
              emptyHint="판매 데이터 없음"
            />
            <CumulativeMiniChart
              title={copy.marginTitle}
              total={cumulativeMargin}
              data={data}
              valueKey="cumulativeMargin"
              stroke="#10b981"
              gradientId="marginGradient"
              emptyHint="마진 데이터 없음"
            />
          </>
        ) : (
          <>
            <PeriodBarChart
              title={copy.salesTitle}
              total={periodSales}
              series={periodSeries}
              valueKey="sales"
              stroke="#7c3aed"
              emptyHint="판매 데이터 없음"
              denseLabels={view === "daily"}
            />
            <PeriodBarChart
              title={copy.marginTitle}
              total={periodMargin}
              series={periodSeries}
              valueKey="margin"
              stroke="#10b981"
              emptyHint="마진 데이터 없음"
              denseLabels={view === "daily"}
            />
          </>
        )}
      </div>

      {!hasData && (
        <p className="mt-2 text-center text-[10px] text-slate-400">
          입금확인·다운로드 발주가 쌓이면 그래프가 올라갑니다
        </p>
      )}
    </div>
  );
}
