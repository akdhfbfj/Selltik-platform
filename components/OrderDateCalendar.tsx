"use client";

import SegmentedDateInput from "@/components/SegmentedDateInput";
import type { OrderDateStatusCounts } from "@/lib/types";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const STATUS_COLORS = {
  draft: { dot: "bg-red-500", text: "text-red-600", label: "임시" },
  paid: { dot: "bg-emerald-500", text: "text-emerald-600", label: "최종" },
  exported: { dot: "bg-blue-500", text: "text-blue-600", label: "발주 완료" },
} as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function totalCounts(counts?: OrderDateStatusCounts): number {
  if (!counts) return 0;
  return counts.draft + counts.paid + counts.exported;
}

interface OrderDateCalendarProps {
  countsByDate: Record<string, OrderDateStatusCounts>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export default function OrderDateCalendar({
  countsByDate,
  selectedDate,
  onSelectDate,
}: OrderDateCalendarProps) {
  const latestDate = Object.keys(countsByDate).sort().at(-1) ?? "";
  const initial = selectedDate || latestDate;

  const [viewYear, setViewYear] = useState(() =>
    initial ? parseInt(initial.slice(0, 4), 10) : new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(() =>
    initial ? parseInt(initial.slice(5, 7), 10) : new Date().getMonth() + 1
  );
  const [jumpDate, setJumpDate] = useState(selectedDate);

  useEffect(() => {
    setJumpDate(selectedDate);
  }, [selectedDate]);

  const cells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const grid: ({ day: number; iso: string } | null)[] = [];

    for (let i = 0; i < firstDow; i++) grid.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      grid.push({ day, iso: toIso(viewYear, viewMonth, day) });
    }
    return grid;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const goToDate = (iso: string) => {
    if (!iso) return;
    setViewYear(parseInt(iso.slice(0, 4), 10));
    setViewMonth(parseInt(iso.slice(5, 7), 10));
    onSelectDate(iso);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
            <Search className="h-3 w-3" />
            날짜 검색
          </label>
          <div className="flex gap-2">
            <SegmentedDateInput
              value={jumpDate}
              onChange={setJumpDate}
              onComplete={goToDate}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => goToDate(jumpDate)}
              disabled={!jumpDate}
              className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-40"
            >
              이동
            </button>
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold text-slate-800">
          {viewYear}년 {viewMonth}월
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectDate("")}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            !selectedDate
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
          }`}
        >
          전체 일자
        </button>
        {selectedDate && (
          <span className="text-xs text-slate-500">
            선택: {selectedDate.replace(/-/g, ".")}
          </span>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
        {(Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).map(
          (key) => (
            <span key={key} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[key].dot}`} />
              {STATUS_COLORS[key].label}
            </span>
          )
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-1 font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500"}`}
          >
            {w}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} />;
          }
          const counts = countsByDate[cell.iso];
          const count = totalCounts(counts);
          const selected = selectedDate === cell.iso;
          const dow = new Date(cell.iso + "T12:00:00").getDay();

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelectDate(selected ? "" : cell.iso)}
              className={`relative flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-xs transition-colors ${
                selected
                  ? "bg-slate-800 font-semibold text-white ring-2 ring-slate-400"
                  : count > 0
                    ? "bg-white font-medium text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
                    : "text-slate-400 hover:bg-white"
              } ${!selected && dow === 0 ? "text-red-500" : ""} ${!selected && dow === 6 ? "text-blue-600" : ""}`}
            >
              <span>{cell.day}</span>
              {counts && count > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5">
                  {counts.draft > 0 && (
                    <span
                      className={`rounded px-0.5 text-[9px] leading-tight ${
                        selected
                          ? "bg-red-400 text-white"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {counts.draft}
                    </span>
                  )}
                  {counts.paid > 0 && (
                    <span
                      className={`rounded px-0.5 text-[9px] leading-tight ${
                        selected
                          ? "bg-emerald-400 text-white"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {counts.paid}
                    </span>
                  )}
                  {counts.exported > 0 && (
                    <span
                      className={`rounded px-0.5 text-[9px] leading-tight ${
                        selected
                          ? "bg-blue-400 text-white"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {counts.exported}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
