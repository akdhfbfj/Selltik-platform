"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { SellerProductView } from "@/lib/types";
import { Clock, Search, Star } from "lucide-react";

interface Props {
  products: SellerProductView[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
  /** 변경 시 검색창 초기화 (장바구니 담기 후 등) */
  resetToken?: number;
  /** 미선택 시 입력란에 표시할 분석·원문 상품명 */
  seedQuery?: string;
  onFocus?: () => void;
}

function recentScore(lastOutboundAt?: string | null): number {
  return lastOutboundAt ? new Date(lastOutboundAt).getTime() : 0;
}

function sortForPicker(list: SellerProductView[]): SellerProductView[] {
  return [...list].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    const recentDiff = recentScore(b.lastOutboundAt) - recentScore(a.lastOutboundAt);
    if (recentDiff !== 0) return recentDiff;
    return a.sortOrder - b.sortOrder;
  });
}

export default function ProductSearchInput({
  products,
  value,
  onChange,
  placeholder = "SKU·상품명 검색",
  resetToken = 0,
  seedQuery = "",
  onFocus,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = products.find((p) => p.id === value);

  useEffect(() => {
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  }, [resetToken]);

  useEffect(() => {
    if (selected) {
      const label = selected.smsName.trim()
        ? selected.smsName.trim()
        : selected.officialName;
      setQuery(label);
    } else if (!value) {
      setQuery(seedQuery.trim());
    }
  }, [selected, value, seedQuery]);

  const { favoriteItems, recentItems, otherItems, showSections } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? products.filter(
          (p) =>
            p.officialName.toLowerCase().includes(q) ||
            p.smsName.toLowerCase().includes(q)
        )
      : products;

    const sorted = sortForPicker(matched);
    const favorites = sorted.filter((p) => p.isFavorite);
    const recent = sorted.filter((p) => !p.isFavorite && p.lastOutboundAt);
    const others = sorted.filter((p) => !p.isFavorite && !p.lastOutboundAt);

    const limitedFavorites = favorites.slice(0, 10);
    const limitedRecent = recent.slice(0, 10);
    const limitOthers = Math.max(
      0,
      30 - limitedFavorites.length - limitedRecent.length
    );
    const limitedOthers = [
      ...recent.slice(10),
      ...others,
    ].slice(0, limitOthers);

    return {
      favoriteItems: limitedFavorites,
      recentItems: limitedRecent,
      otherItems: limitedOthers,
      showSections: !q && (favorites.length > 0 || recent.length > 0),
    };
  }, [products, query]);

  const flatItems = useMemo(
    () => [...favoriteItems, ...recentItems, ...otherItems],
    [favoriteItems, recentItems, otherItems]
  );

  const hasResults = flatItems.length > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, flatItems.length]);

  useEffect(() => {
    if (!open || !hasResults) return;
    const el = listRef.current?.querySelector(
      `[data-picker-index="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, hasResults]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selectProduct = (p: SellerProductView) => {
    onChange(p.id);
    setOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !hasResults) {
      if (e.key === "ArrowDown" && hasResults) {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = flatItems[activeIndex];
      if (picked) selectProduct(picked);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

  const renderItem = (p: SellerProductView, index: number) => {
    const active = index === activeIndex;
    return (
      <li key={p.id} data-picker-index={index}>
        <button
          type="button"
          className={`flex w-full items-start gap-2 px-3 py-2.5 text-left ${
            active ? "bg-emerald-100" : "hover:bg-emerald-50"
          } ${p.isSoldOut ? "opacity-60" : ""}`}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => selectProduct(p)}
        >
          {p.isFavorite ? (
            <Star className="mt-1 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
          ) : p.lastOutboundAt ? (
            <Clock className="mt-1 h-3.5 w-3.5 shrink-0 text-blue-400" />
          ) : (
            <span className="mt-1 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold text-slate-900">
                {p.smsName.trim() || "SKU 미설정"}
                {p.isSoldOut && (
                  <span className="ml-1.5 text-[10px] font-semibold text-slate-500">
                    품절
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                {formatKrw(p.consumerPrice)}
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
              {p.officialName}
            </span>
          </span>
        </button>
      </li>
    );
  };

  let itemIndex = 0;

  return (
    <div ref={wrapRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className={`${inputClass} bg-white pl-9`}
        placeholder={placeholder}
        value={query}
        role="combobox"
        aria-expanded={open && hasResults}
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          onFocus?.();
        }}
        onKeyDown={handleKeyDown}
      />
      {open && hasResults && (
        <ul
          ref={listRef}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {showSections ? (
            <>
              {favoriteItems.length > 0 && (
                <>
                  <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    인기 상품
                  </li>
                  {favoriteItems.map((p) => renderItem(p, itemIndex++))}
                </>
              )}
              {recentItems.length > 0 && (
                <>
                  <li
                    className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600 ${
                      favoriteItems.length > 0
                        ? "mt-1 border-t border-slate-100"
                        : ""
                    }`}
                  >
                    최근 안내
                  </li>
                  {recentItems.map((p) => renderItem(p, itemIndex++))}
                </>
              )}
              {otherItems.length > 0 && (
                <>
                  <li className="mt-1 border-t border-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    전체 상품
                  </li>
                  {otherItems.map((p) => renderItem(p, itemIndex++))}
                </>
              )}
            </>
          ) : (
            flatItems.map((p, idx) => renderItem(p, idx))
          )}
        </ul>
      )}
      {open && query.trim() && !hasResults && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
          검색 결과 없음
        </p>
      )}
    </div>
  );
}
