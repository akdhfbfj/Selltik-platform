"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import SegmentedDateInput from "@/components/SegmentedDateInput";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { ImportedOrderBatch } from "@/lib/types";
import {
  BarChart3,
  Check,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

const CONFIRM_STORAGE_KEY = "finance-batch-confirmed";

function loadConfirmedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(CONFIRM_STORAGE_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as string[];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveConfirmedIds(ids: Set<string>) {
  localStorage.setItem(CONFIRM_STORAGE_KEY, JSON.stringify([...ids]));
}

interface FinanceStats {
  batchCount: number;
  lineCount: number;
  celticDepositTotal: number;
  depositAmountTotal: number;
  sellerSalesTotal: number;
  sellerMarginTotal: number;
  celticCostTotal: number;
  celticMarginTotal: number;
  unmatchedLines: number;
  batches: ImportedOrderBatch[];
  claimBatchCount: number;
  invalidDateBatchCount: number;
}

const emptyStats: FinanceStats = {
  batchCount: 0,
  lineCount: 0,
  celticDepositTotal: 0,
  depositAmountTotal: 0,
  sellerSalesTotal: 0,
  sellerMarginTotal: 0,
  celticCostTotal: 0,
  celticMarginTotal: 0,
  unmatchedLines: 0,
  batches: [],
  claimBatchCount: 0,
  invalidDateBatchCount: 0,
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

export default function AdminFinancePage() {
  const [stats, setStats] = useState<FinanceStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [uploadingPrice, setUploadingPrice] = useState(false);
  const [uploadingOrders, setUploadingOrders] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localConfirmed, setLocalConfirmed] = useState<Set<string>>(loadConfirmedIds);
  const [deletingClaims, setDeletingClaims] = useState(false);
  const [deletingInvalidDates, setDeletingInvalidDates] = useState(false);
  const [defaultYear, setDefaultYear] = useState("2026");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterSeller, setFilterSeller] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [appliedSeller, setAppliedSeller] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadStats = useCallback(
    async (from?: string, to?: string, seller?: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (seller) params.set("seller", seller);
      const qs = params.toString();
      const res = await fetch(
        `/api/admin/order-history/import${qs ? `?${qs}` : ""}`
      );
      const data = await res.json();
      if (res.ok) {
        setStats({
          batchCount: data.batchCount,
          lineCount: data.lineCount,
          celticDepositTotal: data.celticDepositTotal,
          depositAmountTotal: data.depositAmountTotal,
          sellerSalesTotal: data.sellerSalesTotal,
          sellerMarginTotal: data.sellerMarginTotal,
          celticCostTotal: data.celticCostTotal,
          celticMarginTotal: data.celticMarginTotal,
          unmatchedLines: data.unmatchedLines,
          batches: data.batches ?? [],
          claimBatchCount: data.claimBatchCount ?? 0,
          invalidDateBatchCount: data.invalidDateBatchCount ?? 0,
        });
      } else {
        setError(data.error || "통계를 불러오지 못했습니다.");
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    loadStats(
      appliedFrom || undefined,
      appliedTo || undefined,
      appliedSeller || undefined
    );
  }, [appliedFrom, appliedTo, appliedSeller, loadStats]);

  const applyFilters = () => {
    setAppliedFrom(filterFrom);
    setAppliedTo(filterTo);
    setAppliedSeller(filterSeller.trim());
  };

  const resetFilters = () => {
    setFilterFrom("");
    setFilterTo("");
    setFilterSeller("");
    setAppliedFrom("");
    setAppliedTo("");
    setAppliedSeller("");
  };

  const reloadStats = () =>
    loadStats(
      appliedFrom || undefined,
      appliedTo || undefined,
      appliedSeller || undefined
    );

  const handlePriceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPrice(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/celtic-prices/import", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "업로드에 실패했습니다.");
    } else {
      setSuccess(data.message);
    }
    setUploadingPrice(false);
    e.target.value = "";
  };

  const handleOrderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingOrders(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("defaultYear", defaultYear);
    const res = await fetch("/api/admin/order-history/import", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "업로드에 실패했습니다.");
    } else {
      setSuccess(data.message);
      reloadStats();
    }
    setUploadingOrders(false);
    e.target.value = "";
  };

  const handleClear = async () => {
    if (
      !window.confirm(
        "과거 발주 집계 데이터를 모두 삭제합니다. 계속할까요?"
      )
    ) {
      return;
    }
    setClearing(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/admin/order-history/import", {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "삭제에 실패했습니다.");
    } else {
      setLocalConfirmed(new Set());
      saveConfirmedIds(new Set());
      setSuccess(data.message);
      reloadStats();
    }
    setClearing(false);
  };

  const handleDeleteClaims = async () => {
    if (!window.confirm("파일명에 '클'이 포함된 클레임 묶음을 모두 삭제할까요?")) {
      return;
    }
    setDeletingClaims(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/admin/order-history/import?scope=claims", {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "삭제에 실패했습니다.");
    } else {
      setSuccess(data.message);
      reloadStats();
    }
    setDeletingClaims(false);
  };

  const handleDeleteInvalidDates = async () => {
    if (
      !window.confirm(
        "발주일이 1970-01-01인 잘못된 묶음을 삭제합니다. 이후 CSV를 다시 업로드해주세요. 계속할까요?"
      )
    ) {
      return;
    }
    setDeletingInvalidDates(true);
    setError("");
    setSuccess("");
    const res = await fetch(
      "/api/admin/order-history/import?scope=invalid-dates",
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "삭제에 실패했습니다.");
    } else {
      setSuccess(data.message);
      reloadStats();
    }
    setDeletingInvalidDates(false);
  };

  const toggleLocalConfirmed = (id: string) => {
    setLocalConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveConfirmedIds(next);
      return next;
    });
  };

  const handleDeleteBatch = async (batch: ImportedOrderBatch) => {
    const label = [batch.orderDate, batch.batchTitle, batch.sellerName]
      .filter(Boolean)
      .join(" · ");
    if (!window.confirm(`이 발주 묶음을 삭제할까요?\n${label}`)) {
      return;
    }
    setDeletingId(batch.id);
    setError("");
    setSuccess("");
    const res = await fetch(`/api/admin/order-history/import/${batch.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "삭제에 실패했습니다.");
    } else {
      setLocalConfirmed((prev) => {
        const next = new Set(prev);
        next.delete(batch.id);
        saveConfirmedIds(next);
        return next;
      });
      setSuccess("발주 묶음 1건을 삭제했습니다.");
      reloadStats();
    }
    setDeletingId(null);
  };

  const claimCount = stats.claimBatchCount;
  const invalidDateCount = stats.invalidDateBatchCount;
  const filtersActive = Boolean(appliedFrom || appliedTo || appliedSeller);

  const renderRowActions = (b: ImportedOrderBatch) => {
    const confirmed = localConfirmed.has(b.id);
    return (
      <td className="px-4 py-2.5 text-center">
        <div className="inline-flex w-[5.5rem] items-center justify-end gap-1">
          <div className="flex w-14 shrink-0 items-center justify-center">
            {confirmed ? (
              <button
                type="button"
                onClick={() => toggleLocalConfirmed(b.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-50"
                title="확인 해제"
              >
                <Check className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => toggleLocalConfirmed(b.id)}
                className="inline-flex h-8 w-14 items-center justify-center rounded-lg border border-slate-200 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                title="확인"
              >
                확인
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleDeleteBatch(b)}
            disabled={deletingId === b.id}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            title="삭제"
          >
            {deletingId === b.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </td>
    );
  };

  const renderBatchCells = (b: ImportedOrderBatch) => (
    <>
      <td className="whitespace-nowrap px-4 py-2.5">{b.orderDate}</td>
      <td className="max-w-[120px] truncate px-4 py-2.5">
        {b.batchTitle || "—"}
      </td>
      <td className="px-4 py-2.5">{b.sellerName || "—"}</td>
      <td className="px-4 py-2.5 text-right">
        {b.lineCount}
        {b.unmatchedLines > 0 ? (
          <span className="ml-1 text-xs text-amber-600">
            ({b.unmatchedLines}?)
          </span>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
        {formatKrw(b.celticDepositTotal)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
        {b.depositAmount != null ? formatKrw(b.depositAmount) : "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
        {formatKrw(b.sellerMarginTotal)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
        {formatKrw(b.celticMarginTotal)}
      </td>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-brand-600" />
              <h1 className="text-2xl font-bold text-slate-900">자금 흐름 (CSV)</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              발주·송장 종합 CSV는 발주 묶음 단위로 집계만 저장합니다. 셀러 마진은
              (틱톡가−셀러 매입가), 셀틱 마진은 (셀러 매입가−셀틱 매입가)를
              줄마다 합산합니다.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </div>
        ) : null}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="발주 묶음"
            value={loading ? "…" : `${stats.batchCount.toLocaleString()}건`}
            sub={
              filtersActive
                ? `필터 적용 · 상품 줄 ${stats.lineCount.toLocaleString()}줄`
                : `상품 줄 ${stats.lineCount.toLocaleString()}줄`
            }
          />
          <StatCard
            label="셀틱 입금 (계 합)"
            value={loading ? "…" : formatKrw(stats.celticDepositTotal)}
            sub={`실입금 합 ${formatKrw(stats.depositAmountTotal)}`}
          />
          <StatCard
            label="셀러 판매·마진"
            value={loading ? "…" : formatKrw(stats.sellerSalesTotal)}
            sub={`마진 ${formatKrw(stats.sellerMarginTotal)}`}
          />
          <StatCard
            label="셀틱 원가·마진"
            value={loading ? "…" : formatKrw(stats.celticCostTotal)}
            sub={`마진 ${formatKrw(stats.celticMarginTotal)}`}
          />
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">1. 매입가관리 CSV</h2>
            <p className="mt-1 text-sm text-slate-500">
              셀틱·셀러·틱톡 단가 → master_products에 반영
            </p>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-sm text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/50">
              {uploadingPrice ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              ) : (
                <Upload className="h-5 w-5 text-slate-400" />
              )}
              {uploadingPrice ? "업로드 중…" : "매입가관리 CSV 선택"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={uploadingPrice}
                onChange={handlePriceUpload}
              />
            </label>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">2. 발주·송장 종합 CSV</h2>
            <p className="mt-1 text-sm text-slate-500">
              발주일+파일+업체명 묶음별 집계 저장 (중복 묶음은 건너뜀, 파일명
              &apos;클&apos; 클레임 제외)
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <label htmlFor="defaultYear" className="text-slate-600">
                발주일 연도 (M/D 형식)
              </label>
              <input
                id="defaultYear"
                type="number"
                min={2020}
                max={2030}
                value={defaultYear}
                onChange={(e) => setDefaultYear(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1"
              />
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-sm text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/50">
              {uploadingOrders ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              ) : (
                <Upload className="h-5 w-5 text-slate-400" />
              )}
              {uploadingOrders ? "업로드 중…" : "종합 CSV 선택"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={uploadingOrders}
                onChange={handleOrderUpload}
              />
            </label>
            {stats.unmatchedLines > 0 ? (
              <p className="mt-3 text-xs text-amber-700">
                미매칭 상품 줄 {stats.unmatchedLines.toLocaleString()} — 공급가
                표와 상품명이 다르면 판매·마진이 0으로 잡힙니다.
              </p>
            ) : null}
          </section>
        </div>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="mb-1 block text-xs text-slate-500">발주일 시작</span>
              <SegmentedDateInput
                value={filterFrom}
                onChange={setFilterFrom}
              />
            </div>
            <div>
              <span className="mb-1 block text-xs text-slate-500">발주일 종료</span>
              <SegmentedDateInput value={filterTo} onChange={setFilterTo} />
            </div>
            <div className="min-w-[160px] flex-1">
              <label
                htmlFor="filterSeller"
                className="mb-1 block text-xs text-slate-500"
              >
                셀러(업체명)
              </label>
              <input
                id="filterSeller"
                type="text"
                value={filterSeller}
                onChange={(e) => setFilterSeller(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder="예: 띵동이네"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              검색
            </button>
            {filtersActive ? (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                전체 보기
              </button>
            ) : null}
          </div>
          {filtersActive ? (
            <p className="mt-2 text-xs text-slate-500">
              {appliedFrom || "처음"} ~ {appliedTo || "끝"}
              {appliedSeller ? ` · 셀러 "${appliedSeller}"` : ""}
            </p>
          ) : null}
        </section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">
            발주 묶음 전체
            {!loading && stats.batchCount > 0 ? (
              <span className="ml-2 text-sm font-normal text-slate-500">
                {stats.batchCount.toLocaleString()}건 · 오래된 순
              </span>
            ) : null}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {claimCount > 0 ? (
              <button
                type="button"
                onClick={handleDeleteClaims}
                disabled={deletingClaims}
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-40"
              >
                {deletingClaims ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                클레임 삭제 ({claimCount})
              </button>
            ) : null}
            {invalidDateCount > 0 ? (
              <button
                type="button"
                onClick={handleDeleteInvalidDates}
                disabled={deletingInvalidDates}
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-40"
              >
                {deletingInvalidDates ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                잘못된 발주일 삭제 ({invalidDateCount})
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing || stats.batchCount === 0}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-40"
            >
              {clearing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              집계 전체 삭제
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-4 py-3">발주일</th>
                <th className="px-4 py-3">파일</th>
                <th className="px-4 py-3">업체</th>
                <th className="px-4 py-3 text-right">줄</th>
                <th className="px-4 py-3 text-right">셀틱 입금</th>
                <th className="px-4 py-3 text-right">입금액</th>
                <th className="px-4 py-3 text-right">셀러 마진</th>
                <th className="px-4 py-3 text-right">셀틱 마진</th>
                <th className="px-4 py-3 text-center">확인 · 삭제</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : stats.batches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    아직 집계 데이터가 없습니다. CSV를 업로드해주세요.
                  </td>
                </tr>
              ) : (
                stats.batches.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50"
                  >
                    {renderBatchCells(b)}
                    {renderRowActions(b)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
