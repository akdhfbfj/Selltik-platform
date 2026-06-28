"use client";

import { useEffect, useRef, useState } from "react";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: string, month: string, day: string): string {
  if (year.length !== 4 || month.length !== 2 || day.length !== 2) return "";
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  return `${year}-${pad2(m)}-${pad2(d)}`;
}

function splitIso(iso: string): { year: string; month: string; day: string } {
  if (!iso || iso.length < 10) {
    return { year: "", month: "", day: "" };
  }
  const [y, m, d] = iso.slice(0, 10).split("-");
  return { year: y ?? "", month: m ?? "", day: d ?? "" };
}

interface SegmentedDateInputProps {
  value: string;
  onChange: (iso: string) => void;
  onComplete?: (iso: string) => void;
  className?: string;
}

export default function SegmentedDateInput({
  value,
  onChange,
  onComplete,
  className = "",
}: SegmentedDateInputProps) {
  const initial = splitIso(value);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) return;
    const parts = splitIso(value);
    setYear(parts.year);
    setMonth(parts.month);
    setDay(parts.day);
  }, [value]);

  const emit = (y: string, m: string, d: string) => {
    const iso = toIso(y, m, d);
    if (!iso) return;
    onChange(iso);
    if (onComplete) onComplete(iso);
  };

  const handleYear = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    setYear(digits);
    if (digits.length === 4) {
      monthRef.current?.focus();
      monthRef.current?.select();
    }
    emit(digits, month, day);
  };

  const handleMonth = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setMonth(digits);
    if (digits.length === 2) {
      dayRef.current?.focus();
      dayRef.current?.select();
    }
    emit(year, digits, day);
  };

  const handleDay = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setDay(digits);
    emit(year, month, digits);
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="2026"
        maxLength={4}
        value={year}
        onChange={(e) => handleYear(e.target.value)}
        className={`${inputClass} min-w-[4.5rem]`}
        aria-label="연도"
      />
      <span className="text-xs text-slate-400">년</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        placeholder="06"
        maxLength={2}
        value={month}
        onChange={(e) => handleMonth(e.target.value)}
        className={`${inputClass} w-12`}
        aria-label="월"
      />
      <span className="text-xs text-slate-400">월</span>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        placeholder="05"
        maxLength={2}
        value={day}
        onChange={(e) => handleDay(e.target.value)}
        className={`${inputClass} w-12`}
        aria-label="일"
      />
      <span className="text-xs text-slate-400">일</span>
    </div>
  );
}
