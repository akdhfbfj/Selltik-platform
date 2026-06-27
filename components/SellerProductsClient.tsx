"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  describeProductChanges,
  REVIEW_REASON_LABELS,
} from "@/lib/product-review-ui";
import { formatKrw } from "@/lib/parse-supply-csv";
import { extractProductComposition, parseProfitRate } from "@/lib/seller-ui";
import type { SellerProductView } from "@/lib/types";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronRight,
  ListFilter,
  Loader2,
  Search,
  Star,
} from "lucide-react";

interface Props {
  initialProducts: SellerProductView[];
  initialPendingCount: number;
}

type PriceSortKey = "consumerPrice" | "profitAmount" | "profitRate";
type SortDir = "asc" | "desc";

function SortablePriceHeader({
  label,
  sortKey,
  activeSort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: PriceSortKey;
  activeSort: { key: PriceSortKey; dir: SortDir } | null;
  onSort: (key: PriceSortKey) => void;
  className?: string;
}) {
  const active = activeSort?.key === sortKey;
  const dir = active ? activeSort.dir : null;
  const SortIcon =
    dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex w-full items-center justify-end gap-0.5 text-xs font-semibold hover:opacity-80 ${className}`}
      title={
        active
          ? dir === "desc"
            ? "높은 순 (클릭: 낮은 순)"
            : "낮은 순 (클릭: 정렬 해제)"
          : "클릭: 높은 순 정렬"
      }
    >
      {label}
      <SortIcon
        className={`h-3 w-3 shrink-0 ${active ? "" : "opacity-40"}`}
      />
    </button>
  );
}

function buildDraftMap(products: SellerProductView[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of products) {
    map[p.id] = p.smsName;
  }
  return map;
}

export default function SellerProductsClient({
  initialProducts,
  initialPendingCount,
}: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [drafts, setDrafts] = useState(() => buildDraftMap(initialProducts));
  const [pendingReviewCount, setPendingReviewCount] = useState(
    initialPendingCount
  );
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  const [bulkAcking, setBulkAcking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [priceSort, setPriceSort] = useState<{
    key: PriceSortKey;
    dir: SortDir;
  } | null>(null);
  const productRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const modalShownRef = useRef(false);

  const pendingProducts = useMemo(
    () => products.filter((p) => p.needsReview),
    [products]
  );

  useEffect(() => {
    if (initialPendingCount > 0 && !modalShownRef.current) {
      modalShownRef.current = true;
      setShowReviewModal(true);
    }
  }, [initialPendingCount]);

  const refreshProducts = useCallback(async () => {
    setRefreshing(true);
    const res = await fetch("/api/seller/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products);
      setPendingReviewCount(data.pendingReviewCount ?? 0);
      setDrafts(buildDraftMap(data.products));
    }
    setRefreshing(false);
  }, []);

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
      body: JSON.stringify(isBulk ? { all: true } : { productIds }),
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
      setShowPendingOnly(false);
      setShowReviewModal(false);
      setSuccess(`${count}건 확인 처리되었습니다. 전체 상품 목록으로 돌아갑니다.`);
    }

    setAckingId(null);
    setBulkAcking(false);
  };

  const toggleFavorite = async (productId: string, next: boolean) => {
    setFavoritingId(productId);
    setError("");
    const res = await fetch("/api/seller/products/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, favorite: next }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "인기 상품 설정에 실패했습니다.");
    } else {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, isFavorite: next } : p
        )
      );
    }
    setFavoritingId(null);
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
        setSuccess(`SKU ${aliases.length}건이 저장되었습니다.`);
        setProducts(data.products);
        setDrafts(buildDraftMap(data.products));
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
    const composition = extractProductComposition(p.description).toLowerCase();
    return (
      p.officialName.toLowerCase().includes(q) ||
      (drafts[p.id] ?? "").toLowerCase().includes(q) ||
      composition.includes(q)
    );
  });

  const togglePriceSort = (key: PriceSortKey) => {
    setPriceSort((prev) => {
      if (prev?.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  const displayed = useMemo(() => {
    const list = [...filtered];

    if (!priceSort) {
      return list.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    const mul = priceSort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const av =
        priceSort.key === "profitRate"
          ? parseProfitRate(a.profitRate)
          : a[priceSort.key];
      const bv =
        priceSort.key === "profitRate"
          ? parseProfitRate(b.profitRate)
          : b[priceSort.key];
      const diff = (av - bv) * mul;
      return diff !== 0 ? diff : a.sortOrder - b.sortOrder;
    });
    return list;
  }, [filtered, priceSort]);

  const sortStatusLabel = priceSort
    ? `${
        priceSort.key === "consumerPrice"
          ? "판매가"
          : priceSort.key === "profitAmount"
            ? "마진"
            : "마진율"
      } ${priceSort.dir === "desc" ? "높은 순" : "낮은 순"}`
    : "출시 순";

  const inputClass =
    "w-full min-w-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] max-w-6xl flex-col overflow-hidden px-4 py-6 sm:px-6">
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
          SKU는 본인만 설정합니다. ★ 인기 상품은 안내 문자 검색 상단에
          먼저 표시됩니다. 품절 상품은 회색으로 표시됩니다.
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
              placeholder="SKU·상품명 검색"
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
                disabled={bulkAcking || refreshing}
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
            type="button"
            onClick={refreshProducts}
            disabled={refreshing}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {refreshing ? "새로고침…" : "새로고침"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || refreshing}
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

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        {products.length === 0 ? (
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
          <>
            <p className="mb-2 text-xs text-slate-500">
              정렬:{" "}
              <span
                className={
                  priceSort
                    ? "font-medium text-emerald-700"
                    : "font-medium text-slate-700"
                }
              >
                {sortStatusLabel}
              </span>
              {priceSort && (
                <button
                  type="button"
                  onClick={() => setPriceSort(null)}
                  className="ml-2 text-emerald-600 underline hover:text-emerald-800"
                >
                  출시 순으로
                </button>
              )}
            </p>
            <div className="overflow-x-auto pb-4">
            <table className="w-full min-w-[820px] table-fixed border-separate border-spacing-x-0 border-spacing-y-1.5 text-sm">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[12%]" />
                <col className="w-[31%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th
                    className="border border-slate-300 bg-amber-50 px-1 py-2 text-center text-xs font-semibold text-amber-700 first:rounded-l-lg"
                    title="인기 상품"
                  >
                    ★
                  </th>
                  <th className="border border-l-0 border-slate-300 bg-sky-100 px-2 py-2 text-left text-xs font-semibold text-sky-900">
                    SKU
                  </th>
                  <th className="border border-l-0 border-slate-300 bg-slate-200/80 px-2 py-2 text-left text-xs font-semibold text-slate-700">
                    상품명
                  </th>
                  <th className="border border-l-0 border-slate-300 bg-slate-100 px-2 py-2 text-right text-xs font-semibold text-slate-600">
                    매입
                  </th>
                  <th className="border border-l-0 border-slate-300 bg-emerald-100/90 px-2 py-2 text-right">
                    <SortablePriceHeader
                      label="판매"
                      sortKey="consumerPrice"
                      activeSort={priceSort}
                      onSort={togglePriceSort}
                      className="text-emerald-900"
                    />
                  </th>
                  <th className="border border-l-0 border-slate-300 bg-blue-50 px-2 py-2 text-right">
                    <SortablePriceHeader
                      label="마진"
                      sortKey="profitAmount"
                      activeSort={priceSort}
                      onSort={togglePriceSort}
                      className="text-blue-900"
                    />
                  </th>
                  <th className="border border-l-0 border-slate-300 bg-violet-50 px-2 py-2 text-right last:rounded-r-lg">
                    <SortablePriceHeader
                      label="마진율"
                      sortKey="profitRate"
                      activeSort={priceSort}
                      onSort={togglePriceSort}
                      className="text-violet-900"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((p) => {
                  const changes = p.needsReview ? describeProductChanges(p) : [];
                  const composition = extractProductComposition(p.description);
                  const review = p.needsReview;
                  const soldOut = p.isSoldOut;
                  const soldOutCell = soldOut
                    ? "bg-slate-100/90 text-slate-500"
                    : "";
                  return (
                    <tr
                      key={p.id}
                      ref={(el) => {
                        productRefs.current[p.id] = el;
                      }}
                      className={`group align-middle ${soldOut ? "opacity-80" : ""}`}
                    >
                      <td
                        className={`align-middle border border-slate-300 px-1 py-1.5 text-center first:rounded-l-lg ${
                          soldOut ? "bg-slate-100/90" : "bg-amber-50/50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            toggleFavorite(p.id, !p.isFavorite)
                          }
                          disabled={favoritingId === p.id}
                          className="inline-flex items-center justify-center rounded p-1 text-amber-500 transition hover:bg-amber-100 hover:text-amber-600 disabled:opacity-50"
                          title={
                            p.isFavorite
                              ? "인기 상품 해제"
                              : "인기 상품으로 등록"
                          }
                          aria-pressed={p.isFavorite}
                        >
                          {favoritingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Star
                              className={`h-4 w-4 ${
                                p.isFavorite
                                  ? "fill-amber-400 text-amber-500"
                                  : "text-slate-300"
                              }`}
                            />
                          )}
                        </button>
                      </td>
                      <td
                        className={`align-middle border border-l-0 border-slate-300 px-2 py-1.5 ${
                          review
                            ? "bg-amber-50 ring-1 ring-inset ring-amber-200"
                            : soldOut
                              ? soldOutCell
                              : "bg-sky-50/90 group-hover:bg-sky-100/80"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-1">
                          {review && (
                            <span
                              title={
                                REVIEW_REASON_LABELS[p.reviewReason ?? "price_change"]
                              }
                            >
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                            </span>
                          )}
                          <input
                            className={`${inputClass} border-sky-200 bg-white py-1.5 text-xs font-medium text-slate-900 focus:border-sky-400 focus:ring-sky-100`}
                            value={drafts[p.id] ?? ""}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                            }
                            placeholder="SKU"
                            title="안내 문자·발주에 쓰는 SKU"
                          />
                        </div>
                        {review && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {changes.length > 0 && (
                              <span className="text-[10px] leading-snug text-amber-900/80">
                                {changes.join(" · ")}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => acknowledgeProducts([p.id])}
                              disabled={ackingId === p.id}
                              className="text-[10px] font-semibold text-amber-700 underline hover:text-amber-900 disabled:opacity-60"
                            >
                              {ackingId === p.id ? "처리 중…" : "변경 확인"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td
                        className={`align-middle border border-l-0 border-slate-300 px-2 py-1.5 ${
                          soldOut
                            ? soldOutCell
                            : "bg-slate-50/95 group-hover:bg-slate-100/90"
                        }`}
                      >
                        <p
                          className={`break-words text-xs leading-snug ${
                            soldOut ? "text-slate-500" : "text-slate-700"
                          }`}
                        >
                          {p.officialName}
                          {soldOut && (
                            <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              품절
                            </span>
                          )}
                        </p>
                        {composition ? (
                          <p className="mt-0.5 break-words text-[10px] leading-snug text-slate-400">
                            {composition}
                          </p>
                        ) : null}
                      </td>
                      <td
                        className={`whitespace-nowrap align-middle border border-l-0 border-slate-300 px-2 py-1.5 text-right text-[11px] tabular-nums ${
                          soldOut
                            ? `${soldOutCell} text-slate-500`
                            : "bg-slate-50/80 text-slate-600"
                        }`}
                      >
                        {formatKrw(p.purchasePrice)}
                      </td>
                      <td
                        className={`whitespace-nowrap align-middle border border-l-0 border-slate-300 px-2 py-1.5 text-right text-[11px] font-semibold tabular-nums ${
                          soldOut
                            ? `${soldOutCell} text-slate-500`
                            : "bg-emerald-50/70 text-emerald-800"
                        }`}
                      >
                        {formatKrw(p.consumerPrice)}
                      </td>
                      <td
                        className={`whitespace-nowrap align-middle border border-l-0 border-slate-300 px-2 py-1.5 text-right text-[11px] font-medium tabular-nums ${
                          soldOut
                            ? `${soldOutCell} text-slate-500`
                            : "bg-blue-50/60 text-blue-800"
                        }`}
                      >
                        {formatKrw(p.profitAmount)}
                      </td>
                      <td
                        className={`whitespace-nowrap align-middle border border-l-0 border-slate-300 px-2 py-1.5 text-right text-[11px] tabular-nums last:rounded-r-lg ${
                          soldOut
                            ? `${soldOutCell} text-slate-500`
                            : "bg-violet-50/60 text-violet-800"
                        }`}
                      >
                        {p.profitRate || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
