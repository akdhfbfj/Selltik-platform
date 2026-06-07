"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

interface OrderDateCalendarProps {
  /** 발주일별 건수 */
  countsByDate: Record<string, number>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export default function OrderDateCalendar({
  countsByDate,
  selectedDate,
  onSelectDate,
}: OrderDateCalendarProps) {
  const initial = selectedDate || Object.keys(countsByDate).sort().at(-1) || "";
  const [viewYear, setViewYear] = useState(() =>
    initial ? parseInt(initial.slice(0, 4), 10) : new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(() =>
    initial ? parseInt(initial.slice(5, 7), 10) : new Date().getMonth() + 1
  );

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

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
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

      <div className="mb-2 flex flex-wrap gap-2">
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
          <span className="self-center text-xs text-slate-500">
            선택: {selectedDate.replace(/-/g, ".")}
          </span>
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
          const count = countsByDate[cell.iso] ?? 0;
          const selected = selectedDate === cell.iso;
          const dow = new Date(cell.iso + "T12:00:00").getDay();

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelectDate(selected ? "" : cell.iso)}
              className={`relative flex min-h-[2.25rem] flex-col items-center justify-center rounded-lg text-xs transition-colors ${
                selected
                  ? "bg-blue-600 font-semibold text-white"
                  : count > 0
                    ? "bg-white font-medium text-slate-800 ring-1 ring-blue-200 hover:bg-blue-50"
                    : "text-slate-400 hover:bg-white"
              } ${!selected && dow === 0 ? "text-red-500" : ""} ${!selected && dow === 6 ? "text-blue-600" : ""}`}
            >
              <span>{cell.day}</span>
              {count > 0 && (
                <span
                  className={`mt-0.5 text-[10px] leading-none ${
                    selected ? "text-blue-100" : "text-blue-600"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
