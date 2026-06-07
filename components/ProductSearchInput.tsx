"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { SellerProductView } from "@/lib/types";
import { Search } from "lucide-react";

interface Props {
  products: SellerProductView[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
}

export default function ProductSearchInput({
  products,
  value,
  onChange,
  placeholder = "상품명·문자용 이름 검색",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === value);

  useEffect(() => {
    if (selected) {
      const label = selected.smsName
        ? `[${selected.smsName}] ${selected.officialName}`
        : selected.officialName;
      setQuery(label);
    } else if (!value) {
      setQuery("");
    }
  }, [selected, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          p.officialName.toLowerCase().includes(q) ||
          p.smsName.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [products, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

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
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-slate-900">
                  {p.smsName ? `[${p.smsName}] ` : ""}
                  {p.officialName}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {formatKrw(p.consumerPrice)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && filtered.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
          검색 결과 없음
        </p>
      )}
    </div>
  );
}
