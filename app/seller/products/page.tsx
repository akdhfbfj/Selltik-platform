"use client";

import { useCallback, useEffect, useState } from "react";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { SellerProductView } from "@/lib/types";
import { AlertTriangle, Check, Loader2, Search } from "lucide-react";

export default function SellerProductsPage() {
  const [products, setProducts] = useState<SellerProductView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/seller/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products);
      setPendingReviewCount(data.pendingReviewCount ?? 0);
      if ((data.pendingReviewCount ?? 0) > 0) {
        setShowReviewModal(true);
      }
      const map: Record<string, string> = {};
      for (const p of data.products as SellerProductView[]) {
        map[p.id] = p.smsName;
      }
      setDrafts(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleAcknowledge = async (productId: string) => {
    setAckingId(productId);
    setError("");

    const res = await fetch("/api/seller/products/acknowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "확인 처리에 실패했습니다.");
    } else {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, needsReview: false } : p
        )
      );
      setPendingReviewCount((c) => Math.max(0, c - 1));
    }
    setAckingId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    const aliases = products.map((p) => ({
      productId: p.id,
      smsName: drafts[p.id] ?? "",
    }));

    const res = await fetch("/api/seller/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliases }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "저장에 실패했습니다.");
    } else {
      setSuccess("문자용 상품명이 저장되었습니다.");
      setProducts(data.products);
    }
    setSaving(false);
  };

  const filtered = products.filter(
    (p) =>
      p.officialName.toLowerCase().includes(query.toLowerCase()) ||
      (drafts[p.id] ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {showReviewModal && pendingReviewCount > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  공급가 정보 변경 안내
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  셀틱에서 상품 {pendingReviewCount}건의 공급가·판매가 정보가
                  변경되었습니다. 각 상품을 확인해 주세요.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  문자용 상품명은 그대로 유지됩니다. 판매가 등만 다시
                  확인하시면 됩니다.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReviewModal(false)}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">상품·공급가</h2>
        <p className="mt-1 text-sm text-slate-500">
          판매가는 고객 안내용입니다. 문자용 상품명은 본인만 설정합니다.
        </p>
        {pendingReviewCount > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            확인 필요한 상품 {pendingReviewCount}건
          </p>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="상품명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          저장
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : products.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">
          아직 등록된 상품이 없습니다. 셀틱에 문의하세요.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                p.needsReview
                  ? "border-amber-300 ring-1 ring-amber-200"
                  : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-slate-900">{p.officialName}</p>
                {p.needsReview && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="h-3 w-3" />
                    변경 확인 필요
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                판매가 {formatKrw(p.consumerPrice)}
              </p>
              {p.description && (
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                  {p.description}
                </p>
              )}
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  문자용 상품명 (고객에게 보내는 이름)
                </label>
                <input
                  className={inputClass}
                  value={drafts[p.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                  }
                  placeholder={p.officialName}
                />
              </div>
              {p.needsReview && (
                <button
                  onClick={() => handleAcknowledge(p.id)}
                  disabled={ackingId === p.id}
                  className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {ackingId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  확인하기
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
