"use client";

import { useCallback, useEffect, useState } from "react";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { SellerProductView } from "@/lib/types";
import { Check, Loader2, Search } from "lucide-react";

export default function SellerProductsPage() {
  const [products, setProducts] = useState<SellerProductView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/seller/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products);
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
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">상품·공급가</h2>
        <p className="mt-1 text-sm text-slate-500">
          판매가는 고객 안내용입니다. 문자용 상품명은 본인만 설정합니다.
        </p>
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
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="font-medium text-slate-900">{p.officialName}</p>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
