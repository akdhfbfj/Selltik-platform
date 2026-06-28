"use client";

import type { SellerOrderDailyMetric } from "@/lib/types";
import { formatKrw } from "@/lib/parse-supply-csv";
import { TrendingUp } from "lucide-react";

interface Props {
  data: SellerOrderDailyMetric[];
  monthLabel: string;
}

const W = 320;
const H = 88;
const PAD = { top: 8, right: 8, bottom: 22, left: 36 };

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

function MiniChart({
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

export default function SellerRevenueChart({ data, monthLabel }: Props) {
  const last = data[data.length - 1];
  const totalSales = last?.cumulativeSales ?? 0;
  const totalMargin = last?.cumulativeMargin ?? 0;
  const hasData = totalSales > 0 || totalMargin > 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white/70 p-4">
      <div className="mb-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          {monthLabel} 매출 추이
        </div>
        <p className="mt-0.5 text-[10px] text-slate-400">
          발주 확정 기준 누적 · 위로 갈수록 성장
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <MiniChart
          title="누적 판매"
          total={totalSales}
          data={data}
          valueKey="cumulativeSales"
          stroke="#7c3aed"
          gradientId="salesGradient"
          emptyHint="판매 데이터 없음"
        />
        <MiniChart
          title="누적 마진"
          total={totalMargin}
          data={data}
          valueKey="cumulativeMargin"
          stroke="#10b981"
          gradientId="marginGradient"
          emptyHint="마진 데이터 없음"
        />
      </div>

      {!hasData && (
        <p className="mt-2 text-center text-[10px] text-slate-400">
          입금확인·다운로드 발주가 쌓이면 그래프가 올라갑니다
        </p>
      )}
    </div>
  );
}
