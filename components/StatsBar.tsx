"use client";

import {
  STATUS_COLORS,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/lib/types";
import type { ContactStatus } from "@/lib/types";

interface Props {
  stats: { total: number; byStatus: Record<string, number> };
  onStatusClick: (status: ContactStatus | "all") => void;
  activeStatus: ContactStatus | "all";
}

function StatCard({
  count,
  label,
  description,
  active,
  labelClass = "text-slate-500",
  onClick,
}: {
  count: number;
  label: string;
  description: string;
  active: boolean;
  labelClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-brand-300 bg-brand-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <p className="text-2xl font-bold text-slate-900">{count}</p>
      <p className={`mt-0.5 text-xs font-semibold ${labelClass}`}>{label}</p>
      <p className="mt-1 text-[11px] leading-snug text-slate-400">{description}</p>
    </button>
  );
}

export default function StatsBar({ stats, onStatusClick, activeStatus }: Props) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard
        count={stats.total}
        label="전체"
        description="등록된 모든 업체"
        active={activeStatus === "all"}
        onClick={() => onStatusClick("all")}
      />
      {STATUS_ORDER.map((status) => (
        <StatCard
          key={status}
          count={stats.byStatus[status] || 0}
          label={STATUS_LABELS[status]}
          description={STATUS_DESCRIPTIONS[status]}
          active={activeStatus === status}
          labelClass={STATUS_COLORS[status].split(" ")[1]}
          onClick={() => onStatusClick(status)}
        />
      ))}
    </div>
  );
}
