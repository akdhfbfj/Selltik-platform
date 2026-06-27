"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { SellerProductView } from "@/lib/types";
import { Search, Star } from "lucide-react";

interface Props {
  products: SellerProductView[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
  /** 변경 시 검색창 초기화 (장바구니 담기 후 등) */
  resetToken?: number;
}

function sortForPicker(list: SellerProductView[]): SellerProductView[] {
  return [...list].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
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

  const { favoriteItems, otherItems, showSections } = useMemo(() => {
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
    const others = sorted.filter((p) => !p.isFavorite);
    const limitedFavorites = favorites.slice(0, 15);
    const limitOthers = 30 - limitedFavorites.length;
    const limitedOthers = others.slice(0, Math.max(0, limitOthers));

    return {
      favoriteItems: limitedFavorites,
      otherItems: limitedOthers,
      showSections: !q && favorites.length > 0,
    };
  }, [products, query]);

  const hasResults = favoriteItems.length > 0 || otherItems.length > 0;

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
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-emerald-50"
        onClick={() => {
          onChange(p.id);
          setOpen(false);
        }}
      >
        {p.isFavorite ? (
          <Star className="mt-1 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
        ) : (
          <span className="mt-1 w-3.5 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">
              {p.smsName.trim() || "SKU 미설정"}
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
          {showSections && favoriteItems.length > 0 && (
            <>
              <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                인기 상품
              </li>
              {favoriteItems.map(renderItem)}
              {otherItems.length > 0 && (
                <li className="mt-1 border-t border-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  전체 상품
                </li>
              )}
            </>
          )}
          {(showSections ? otherItems : [...favoriteItems, ...otherItems]).map(
            renderItem
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
