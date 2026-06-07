"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  describeProductChanges,
  REVIEW_REASON_LABELS,
} from "@/lib/product-review-ui";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { SellerProductView } from "@/lib/types";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ListFilter,
  Loader2,
  Search,
} from "lucide-react";

export default function SellerProductsPage() {
  const [products, setProducts] = useState<SellerProductView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [bulkAcking, setBulkAcking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const productRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const pendingProducts = useMemo(
    () => products.filter((p) => p.needsReview),
    [products]
  );

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

  const scrollToProduct = (productId: string) => {
    setShowReviewModal(false);
    setShowPendingOnly(false);
    setQuery("");
    requestAnimationFrame(() => {
      productRefs.current[productId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const acknowledgeProducts = async (productIds?: string[]) => {
    const isBulk = !productIds;
    if (isBulk) setBulkAcking(true);
    else if (productIds.length === 1) setAckingId(productIds[0]);
    setError("");

    const res = await fetch("/api/seller/products/acknowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isBulk ? { all: true } : { productIds }
      ),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "확인 처리에 실패했습니다.");
    } else {
      const count = data.count ?? productIds?.length ?? 0;
      const idSet = new Set(productIds ?? pendingProducts.map((p) => p.id));
      setProducts((prev) =>
        prev.map((p) =>
          idSet.has(p.id) ? { ...p, needsReview: false } : p
        )
      );
      setPendingReviewCount((c) => Math.max(0, c - count));
      setSuccess(`${count}건 확인 처리되었습니다.`);
      if (pendingProducts.length - count <= 0) {
        setShowReviewModal(false);
      }
    }

    setAckingId(null);
    setBulkAcking(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    const aliases = products
      .filter((p) => (drafts[p.id] ?? "") !== (p.smsName ?? ""))
      .map((p) => ({
        productId: p.id,
        smsName: drafts[p.id] ?? "",
      }));

    if (aliases.length === 0) {
      setSuccess("변경된 내용이 없습니다.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/seller/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aliases }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "저장에 실패했습니다.");
      } else {
        setSuccess(`문자용 상품명 ${aliases.length}건이 저장되었습니다.`);
        setProducts(data.products);
        const map: Record<string, string> = {};
        for (const p of data.products as SellerProductView[]) {
          map[p.id] = p.smsName;
        }
        setDrafts(map);
      }
    } catch {
      setError("저장 중 오류가 발생했습니다. 네트워크를 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    if (showPendingOnly && !p.needsReview) return false;
    const q = query.toLowerCase();
    return (
      p.officialName.toLowerCase().includes(q) ||
      (drafts[p.id] ?? "").toLowerCase().includes(q)
    );
  });

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] max-w-5xl flex-col overflow-hidden px-4 py-6 sm:px-6">
      {showReviewModal && pendingProducts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-100 p-2">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    공급가 정보 변경 안내
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    확인 필요한 상품 {pendingProducts.length}건입니다. 항목을
                    누르면 해당 상품으로 이동합니다.
                  </p>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <ul className="space-y-2">
                {pendingProducts.map((p) => {
                  const changes = describeProductChanges(p);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => scrollToProduct(p.id)}
                        className="flex w-full items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-left hover:bg-amber-50"
                      >
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">
                            {p.officialName}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-amber-800">
                            {REVIEW_REASON_LABELS[p.reviewReason ?? "price_change"]}
                          </p>
                          {changes.slice(0, 2).map((line) => (
                            <p
                              key={line}
                              className="mt-0.5 text-xs text-slate-600"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-100 p-4 sm:flex-row">
              <button
                type="button"
                onClick={() => acknowledgeProducts()}
                disabled={bulkAcking}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {bulkAcking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {pendingProducts.length}건 일괄 확인
              </button>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="shrink-0 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">상품·공급가</h2>
        <p className="mt-1 text-sm text-slate-500">
          판매가는 고객 안내용입니다. 문자용 상품명은 본인만 설정합니다.
        </p>
        {pendingReviewCount > 0 && (
          <button
            type="button"
            onClick={() => setShowReviewModal(true)}
            className="mt-2 flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900"
          >
            <AlertTriangle className="h-4 w-4" />
            확인 필요한 상품 {pendingReviewCount}건 — 클릭하여 목록 보기
          </button>
        )}
      </div>

      <div className="shrink-0 border-b border-slate-200 bg-slate-50 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} bg-white pl-9`}
              placeholder="상품명 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {pendingReviewCount > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowPendingOnly((v) => !v)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                  showPendingOnly
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <ListFilter className="h-4 w-4" />
                확인 필요만
              </button>
              <button
                type="button"
                onClick={() => acknowledgeProducts()}
                disabled={bulkAcking || loading}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              >
                {bulkAcking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                일괄 확인
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
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
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            아직 등록된 상품이 없습니다. 셀틱에 문의하세요.
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            {showPendingOnly
              ? "확인 필요한 상품이 없습니다."
              : "검색 결과가 없습니다."}
          </p>
        ) : (
          <div className="space-y-3 pb-4">
            {filtered.map((p) => {
              const changes = p.needsReview ? describeProductChanges(p) : [];
              return (
                <div
                  key={p.id}
                  ref={(el) => {
                    productRefs.current[p.id] = el;
                  }}
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
                        {REVIEW_REASON_LABELS[p.reviewReason ?? "price_change"]}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                    판매가 {formatKrw(p.consumerPrice)}
                  </p>
                  {p.needsReview && changes.length > 0 && (
                    <ul className="mt-2 space-y-0.5 rounded-lg bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                      {changes.map((line) => (
                        <li key={line}>· {line}</li>
                      ))}
                    </ul>
                  )}
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
                      onClick={() => acknowledgeProducts([p.id])}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
