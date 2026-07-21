"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  SellerBroadcast,
  SellerGrowthStats,
  SellerReflectionEntry,
  SellerOrderDailyMetric,
  SellerOrderRevenueTrends,
} from "@/lib/types";
import { formatKrw } from "@/lib/parse-supply-csv";
import SellerRevenueChart from "@/components/SellerRevenueChart";
import type { SellerGrowthDashboardData } from "@/lib/seller-growth";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Radio,
  Trash2,
  X,
} from "lucide-react";

const EMPTY_REVENUE_TRENDS: SellerOrderRevenueTrends = {
  daily: [],
  weekly: [],
  monthly: [],
};

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}년 ${m}월`;
}

function dateLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number);
  return `${m}월 ${d}일`;
}

function AchievementBar({ pct, className = "mt-1 w-24" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function InlineStat({
  label,
  value,
  accent = "text-slate-800",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${accent}`}>{value}</span>
    </div>
  );
}

function GoalRow({
  label,
  targetDraft,
  onTargetChange,
  onSave,
  saving,
  revenueLabel,
  revenueValue,
  marginLabel,
  marginValue,
  revenueAccent,
  achievementPct,
  hasTarget,
}: {
  label: string;
  targetDraft: string;
  onTargetChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  revenueLabel: string;
  revenueValue: string;
  marginLabel: string;
  marginValue: string;
  revenueAccent: string;
  achievementPct: number;
  hasTarget: boolean;
}) {
  return (
    <div className="grid items-center gap-x-2 gap-y-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 sm:grid-cols-[8.5rem_9rem_2.75rem_1fr_auto]">
      <span className="truncate text-xs font-semibold text-slate-700">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={targetDraft}
        onChange={(e) => onTargetChange(formatDigitsWithCommas(e.target.value))}
        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold"
      />
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="w-full rounded bg-violet-600 px-1 py-1 text-[10px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        저장
      </button>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <InlineStat label={revenueLabel} value={revenueValue} accent={revenueAccent} />
        <InlineStat label={marginLabel} value={marginValue} accent="text-emerald-700" />
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <InlineStat
          label="달성"
          value={hasTarget ? `${achievementPct}%` : "—"}
          accent="text-emerald-700"
        />
        {hasTarget && <AchievementBar pct={achievementPct} className="w-20" />}
      </div>
    </div>
  );
}

function weekdayLabels(): string[] {
  return ["일", "월", "화", "수", "목", "금", "토"];
}

function calendarCells(monthKey: string): (number | null)[] {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0).getDate();
  const pad = first.getDay();
  const cells: (number | null)[] = Array(pad).fill(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dateKey(monthKey: string, day: number): string {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function formatTimeDisplay(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5);
}

function formatDigitsWithCommas(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function parseDigits(raw: string): number {
  return Number(raw.replace(/\D/g, "") || 0);
}

function formatTimeInputField(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function parseTimeInput(val: string): string | null {
  const v = val.trim();
  if (!v) return null;

  let hour: number | null = null;
  let minute: number | null = null;

  const colonMatch = v.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    hour = Number(colonMatch[1]);
    minute = Number(colonMatch[2]);
  } else {
    const digits = v.replace(/\D/g, "");
    if (digits.length >= 3 && digits.length <= 4) {
      const padded = digits.padStart(4, "0");
      hour = Number(padded.slice(0, 2));
      minute = Number(padded.slice(2, 4));
    }
  }

  if (hour === null || minute === null) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function appendReflectionLine(
  existing: string,
  date: string,
  newNote: string
): string {
  const trimmed = newNote.trim();
  if (!trimmed) return existing.trim();
  const line = `[${date}] ${trimmed}`;
  const base = existing.trim();
  return base ? `${base}\n${line}` : line;
}

/** 복기 메모 편집용 — 날짜 접두어 제거 */
function reflectionDisplayText(memo: string): string {
  if (!memo.trim()) return "";
  return memo
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(/^\[\d{4}-\d{2}-\d{2}\]\s*(.+)$/);
      return match ? match[1] : trimmed;
    })
    .filter(Boolean)
    .join("\n");
}

function reflectionMemoFromInput(date: string, note: string): string {
  const trimmed = note.trim();
  if (!trimmed) return "";
  if (trimmed.includes("\n")) {
    return trimmed
      .split("\n")
      .map((line) => {
        const t = line.trim();
        if (!t) return "";
        return t.match(/^\[\d{4}-\d{2}-\d{2}\]/)
          ? t
          : `[${date}] ${t}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  return `[${date}] ${trimmed}`;
}

type FormState = {
  id?: string;
  existingMemo?: string;
  broadcastDate: string;
  startTime: string;
  endTime: string;
  revenue: string;
  reflectionNote: string;
};

const emptyForm = (date = ""): FormState => ({
  broadcastDate: date,
  startTime: "",
  endTime: "",
  revenue: "",
  reflectionNote: "",
});

function applyGrowthPayload(
  data: SellerGrowthDashboardData,
  setters: {
    setStats: (v: SellerGrowthStats | null) => void;
    setBroadcasts: (v: SellerBroadcast[]) => void;
    setReflections: (v: SellerReflectionEntry[]) => void;
    setOrderDailyMetrics: (v: SellerOrderDailyMetric[]) => void;
    setOrderRevenueTrends: (v: SellerOrderRevenueTrends) => void;
    setTargetDraft: (v: string) => void;
    setDailyTargetDraft: (v: string) => void;
    setError: (v: string) => void;
  }
) {
  setters.setStats(data.stats ?? null);
  setters.setBroadcasts(data.broadcasts ?? []);
  setters.setReflections(data.reflections ?? []);
  setters.setOrderDailyMetrics(data.orderDailyMetrics ?? []);
  setters.setOrderRevenueTrends(
    data.orderRevenueTrends ?? EMPTY_REVENUE_TRENDS
  );
  setters.setTargetDraft(
    formatDigitsWithCommas(String(data.stats?.targetRevenue ?? 0))
  );
  setters.setDailyTargetDraft(
    formatDigitsWithCommas(String(data.stats?.dailyTargetRevenue ?? 0))
  );
  setters.setError(data.dbError ?? "");
}

type Props = {
  initialData?: SellerGrowthDashboardData & { monthKey: string };
};

export default function SellerGrowthSection({ initialData }: Props) {
  const [monthKey, setMonthKey] = useState(
    initialData?.monthKey ?? currentMonthKey()
  );
  const [stats, setStats] = useState<SellerGrowthStats | null>(
    initialData?.stats ?? null
  );
  const [broadcasts, setBroadcasts] = useState<SellerBroadcast[]>(
    initialData?.broadcasts ?? []
  );
  const [reflections, setReflections] = useState<SellerReflectionEntry[]>(
    initialData?.reflections ?? []
  );
  const [orderDailyMetrics, setOrderDailyMetrics] = useState<
    SellerOrderDailyMetric[]
  >(initialData?.orderDailyMetrics ?? []);
  const [orderRevenueTrends, setOrderRevenueTrends] =
    useState<SellerOrderRevenueTrends>(
      initialData?.orderRevenueTrends ?? EMPTY_REVENUE_TRENDS
    );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(initialData?.dbError ?? "");
  const [targetDraft, setTargetDraft] = useState(() =>
    formatDigitsWithCommas(String(initialData?.stats?.targetRevenue ?? 0))
  );
  const [dailyTargetDraft, setDailyTargetDraft] = useState(() =>
    formatDigitsWithCommas(String(initialData?.stats?.dailyTargetRevenue ?? 0))
  );
  const [savingTarget, setSavingTarget] = useState(false);
  const [savingDailyTarget, setSavingDailyTarget] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [savingForm, setSavingForm] = useState(false);
  const [timeError, setTimeError] = useState("");

  const broadcastsByDate = useMemo(() => {
    const map = new Map<string, SellerBroadcast[]>();
    for (const b of broadcasts) {
      const list = map.get(b.broadcastDate) ?? [];
      list.push(b);
      map.set(b.broadcastDate, list);
    }
    return map;
  }, [broadcasts]);

  const skipInitialFetch = useRef(
    !!initialData && initialData.monthKey === monthKey
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/seller/growth?month=${monthKey}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "데이터를 불러오지 못했습니다.");
      setLoading(false);
      return;
    }
    applyGrowthPayload(data, {
      setStats,
      setBroadcasts,
      setReflections,
      setOrderDailyMetrics,
      setOrderRevenueTrends,
      setTargetDraft,
      setDailyTargetDraft,
      setError,
    });
    setLoading(false);
  }, [monthKey]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    load();
  }, [load]);

  const handleSaveTarget = async () => {
    setSavingTarget(true);
    setError("");
    const res = await fetch("/api/seller/growth", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "monthly",
        monthKey,
        targetRevenue: parseDigits(targetDraft),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "목표 저장에 실패했습니다.");
    } else {
      await load();
    }
    setSavingTarget(false);
  };

  const handleSaveDailyTarget = async () => {
    if (!stats?.dateKey) return;
    setSavingDailyTarget(true);
    setError("");
    const res = await fetch("/api/seller/growth", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "daily",
        dateKey: stats.dateKey,
        targetRevenue: parseDigits(dailyTargetDraft),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "일간 목표 저장에 실패했습니다.");
    } else {
      await load();
    }
    setSavingDailyTarget(false);
  };

  const openCreate = (date?: string) => {
    setTimeError("");
    setForm(emptyForm(date ?? `${monthKey}-01`));
    setFormOpen(true);
  };

  const openEdit = (b: SellerBroadcast) => {
    setTimeError("");
    setForm({
      id: b.id,
      existingMemo: b.memo,
      broadcastDate: b.broadcastDate,
      startTime: formatTimeDisplay(b.startTime),
      endTime: formatTimeDisplay(b.endTime),
      revenue: formatDigitsWithCommas(String(b.revenue)),
      reflectionNote: reflectionDisplayText(b.memo),
    });
    setFormOpen(true);
  };

  const handleSaveForm = async () => {
    if (!form.broadcastDate) {
      setError("방송 날짜를 입력해 주세요.");
      return;
    }

    const startTime = parseTimeInput(form.startTime);
    const endTime = parseTimeInput(form.endTime);
    if (form.startTime.trim() && !startTime) {
      setTimeError("시작 시간은 19:30 형식(24시간)으로 입력해 주세요.");
      return;
    }
    if (form.endTime.trim() && !endTime) {
      setTimeError("종료 시간은 19:30 형식(24시간)으로 입력해 주세요.");
      return;
    }
    setTimeError("");

    const memo = form.id
      ? reflectionMemoFromInput(form.broadcastDate, form.reflectionNote)
      : appendReflectionLine("", form.broadcastDate, form.reflectionNote);

    setSavingForm(true);
    setError("");
    const payload = {
      broadcastDate: form.broadcastDate,
      startTime,
      endTime,
      revenue: parseDigits(form.revenue),
      memo,
    };
    const res = form.id
      ? await fetch(`/api/seller/broadcasts/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/seller/broadcasts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "저장에 실패했습니다.");
    } else {
      setFormOpen(false);
      await load();
    }
    setSavingForm(false);
  };

  const handleDelete = async (b: SellerBroadcast) => {
    if (!confirm(`${b.broadcastDate} 방송 기록을 삭제할까요?`)) return;
    const res = await fetch(`/api/seller/broadcasts/${b.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "삭제에 실패했습니다.");
      return;
    }
    await load();
  };

  const cells = calendarCells(monthKey);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="mb-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-violet-600" />
          <h3 className="text-sm font-semibold text-slate-800">나의 방송</h3>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-0.5 text-sm">
          <button
            type="button"
            onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="이전 달"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[5.5rem] text-center font-medium text-slate-700">
            {monthLabel(monthKey)}
          </span>
          <button
            type="button"
            onClick={() => setMonthKey((m) => shiftMonthKey(m, 1))}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="다음 달"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          불러오는 중…
        </div>
      ) : (
        <>
          {stats && (
            <div className="mb-4 space-y-2">
              <GoalRow
                label={`월간 · ${monthLabel(monthKey)}`}
                targetDraft={targetDraft}
                onTargetChange={setTargetDraft}
                onSave={handleSaveTarget}
                saving={savingTarget}
                revenueLabel="매출"
                revenueValue={formatKrw(stats.orderSalesTotal)}
                marginLabel="마진"
                marginValue={formatKrw(stats.orderMarginTotal)}
                revenueAccent="text-violet-700"
                achievementPct={stats.achievementPct}
                hasTarget={stats.targetRevenue > 0}
              />
              <GoalRow
                label={`일간 · ${dateLabel(stats.dateKey)}`}
                targetDraft={dailyTargetDraft}
                onTargetChange={setDailyTargetDraft}
                onSave={handleSaveDailyTarget}
                saving={savingDailyTarget}
                revenueLabel="오늘 매출"
                revenueValue={formatKrw(stats.dailyOrderSales)}
                marginLabel="오늘 마진"
                marginValue={formatKrw(stats.dailyOrderMargin)}
                revenueAccent="text-violet-700"
                achievementPct={stats.dailyAchievementPct}
                hasTarget={stats.dailyTargetRevenue > 0}
              />

              {/* 평균 지표 — 한 줄 */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-xs">
                <span className="font-semibold text-slate-600">평균 지표</span>
                <InlineStat
                  label="최근 4회"
                  value={formatKrw(stats.recentAvgRevenue)}
                />
                <InlineStat
                  label="월 방송"
                  value={`${stats.broadcastCount}회`}
                />
                <InlineStat
                  label="발주 판매"
                  value={formatKrw(stats.orderSalesTotal)}
                  accent="text-violet-700"
                />
                <InlineStat
                  label="마진"
                  value={formatKrw(stats.orderMarginTotal)}
                  accent="text-emerald-700"
                />
                <InlineStat
                  label="발주"
                  value={`${stats.orderCount}건`}
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <CalendarDays className="h-4 w-4" />
                  방송 캘린더
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openCreate(today.startsWith(monthKey) ? today : undefined)
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  기록 추가
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-slate-400">
                {weekdayLabels().map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) {
                    return <div key={`empty-${i}`} className="aspect-square" />;
                  }
                  const key = dateKey(monthKey, day);
                  const dayBroadcasts = broadcastsByDate.get(key) ?? [];
                  const total = dayBroadcasts.reduce((s, b) => s + b.revenue, 0);
                  const isToday = key === today;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (dayBroadcasts.length === 1) {
                          openEdit(dayBroadcasts[0]);
                        } else if (dayBroadcasts.length > 1) {
                          openEdit(dayBroadcasts[dayBroadcasts.length - 1]);
                        } else {
                          openCreate(key);
                        }
                      }}
                      onDoubleClick={() => openCreate(key)}
                      className={`aspect-square rounded-lg border p-0.5 text-left text-[10px] transition hover:border-violet-300 hover:bg-violet-50 ${
                        isToday
                          ? "border-violet-400 bg-violet-50/80"
                          : dayBroadcasts.length
                            ? "border-violet-200 bg-violet-50/50"
                            : "border-slate-100 bg-slate-50/50"
                      }`}
                      title={
                        dayBroadcasts.length
                          ? dayBroadcasts
                              .map(
                                (b) =>
                                  `${formatTimeDisplay(b.startTime) || "시간 미입력"} ${formatKrw(b.revenue)}`
                              )
                              .join("\n")
                          : "클릭하여 기록 추가"
                      }
                    >
                      <span className="font-medium text-slate-700">{day}</span>
                      {total > 0 && (
                        <span className="block truncate text-[9px] font-semibold text-violet-700">
                          {(total / 10000).toFixed(0)}만
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {broadcasts.length > 0 && (
                <ul className="mt-3 max-h-36 space-y-1.5 overflow-y-auto border-t border-slate-100 pt-3">
                  {broadcasts.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/80 px-2 py-1.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          {b.broadcastDate.slice(5).replace("-", "/")}
                          {(b.startTime || b.endTime) && (
                            <span className="ml-1.5 font-normal text-slate-500">
                              {formatTimeDisplay(b.startTime)}
                              {b.endTime ? `~${formatTimeDisplay(b.endTime)}` : ""}
                            </span>
                          )}
                        </p>
                        <p className="text-slate-500">{formatKrw(b.revenue)}</p>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEdit(b)}
                          className="rounded p-1 text-slate-500 hover:bg-white"
                          aria-label="수정"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(b)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          aria-label="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <SellerRevenueChart
              data={orderDailyMetrics}
              trends={orderRevenueTrends}
              monthLabel={monthLabel(monthKey)}
            />
          </div>

          {reflections.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 p-4">
              <h4 className="mb-2 text-xs font-semibold text-slate-700">
                복기 목록
              </h4>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-xs text-slate-600">
                {reflections.map((r, i) => (
                  <li key={`${r.broadcastId}-${i}`} className="border-l-2 border-violet-200 pl-2">
                    <span className="font-medium text-slate-500">{r.date}</span>
                    <p className="mt-0.5 leading-relaxed">{r.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="font-semibold text-slate-900">
                {form.id ? "방송 기록 수정" : "방송 기록 추가"}
              </h4>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-slate-600">
                날짜
                <input
                  type="date"
                  value={form.broadcastDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, broadcastDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-slate-600">
                  시작 (24시, 예: 19:30)
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="19:30"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        startTime: formatTimeInputField(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  종료 (24시, 예: 21:00)
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="21:00"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        endTime: formatTimeInputField(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              {timeError && (
                <p className="text-xs text-red-600">{timeError}</p>
              )}
              <label className="block text-xs text-slate-600">
                방송 매출 (원)
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.revenue}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      revenue: formatDigitsWithCommas(e.target.value),
                    }))
                  }
                  placeholder="1,000,000"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-slate-600">
                복기할 점
                <textarea
                  value={form.reflectionNote}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reflectionNote: e.target.value }))
                  }
                  placeholder="오늘 방송에서 배운 점, 다음에 개선할 점"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              {form.id && (
                <p className="text-[11px] text-slate-400">
                  수정 시 복기 내용이 교체됩니다.
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={savingForm}
                onClick={handleSaveForm}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {savingForm ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
