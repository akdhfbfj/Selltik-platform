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
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === value);

  useEffect(() => {
    setQuery("");
    setOpen(false);
  }, [resetToken]);

  useEffect(() => {
    if (selected) {
      const label = selected.smsName.trim()
        ? selected.smsName.trim()
        : selected.officialName;
      setQuery(label);
    } else if (!value) {
      setQuery("");
    }
  }, [selected, value]);

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
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

  const renderItem = (p: SellerProductView) => (
    <li key={p.id}>
      <button
        type="button"
        className={`flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-emerald-50 ${
          p.isSoldOut ? "opacity-60" : ""
        }`}
        onClick={() => {
          onChange(p.id);
          setOpen(false);
        }}
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

  return (
    <div ref={wrapRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className={`${inputClass} bg-white pl-9`}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onChange("");
        }}
        onFocus={() => setOpen(true)}
      />
      {open && hasResults && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {showSections ? (
            <>
              {favoriteItems.length > 0 && (
                <>
                  <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    인기 상품
                  </li>
                  {favoriteItems.map(renderItem)}
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
                  {recentItems.map(renderItem)}
                </>
              )}
              {otherItems.length > 0 && (
                <>
                  <li className="mt-1 border-t border-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    전체 상품
                  </li>
                  {otherItems.map(renderItem)}
                </>
              )}
            </>
          ) : (
            flatItems.map(renderItem)
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
