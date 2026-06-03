"use client";

import type { ContactStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { Download, Grid3X3, List, Search } from "lucide-react";
import { STATUS_OPTIONS } from "@/lib/types";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: ContactStatus | "all";
  onStatusChange: (v: ContactStatus | "all") => void;
  tagFilter: string;
  onTagChange: (v: string) => void;
  tags: string[];
  viewMode: "grid" | "list";
  onViewModeChange: (v: "grid" | "list") => void;
  onExport: () => void;
  resultCount: number;
  totalCount: number;
}

export default function FilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  tagFilter,
  onTagChange,
  tags,
  viewMode,
  onViewModeChange,
  onExport,
  resultCount,
  totalCount,
}: Props) {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="업체명, 담당자, 전화, 상품, 메모 검색..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
            value={statusFilter}
            onChange={(e) =>
              onStatusChange(e.target.value as ContactStatus | "all")
            }
          >
            <option value="all">전체 상태</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {tags.length > 0 && (
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
              value={tagFilter}
              onChange={(e) => onTagChange(e.target.value)}
            >
              <option value="">전체 태그</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          )}
          <div className="flex rounded-xl border border-slate-200 bg-white">
            <button
              onClick={() => onViewModeChange("grid")}
              className={`rounded-l-xl p-2.5 ${viewMode === "grid" ? "bg-brand-50 text-brand-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewModeChange("list")}
              className={`rounded-r-xl p-2.5 ${viewMode === "list" ? "bg-brand-50 text-brand-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            title="CSV 내보내기"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">내보내기</span>
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        {resultCount === totalCount
          ? `총 ${totalCount}개 업체`
          : `${resultCount}개 / 전체 ${totalCount}개`}
      </p>
    </div>
  );
}
