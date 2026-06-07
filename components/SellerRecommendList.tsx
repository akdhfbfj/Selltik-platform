"use client";

import { useEffect, useState } from "react";
import type { Recommendation } from "@/lib/types";
import {
  RECOMMENDATION_STATUS_COLORS,
  RECOMMENDATION_STATUS_LABELS,
} from "@/lib/types";
import { Check, Loader2, Pencil, X } from "lucide-react";

type EditForm = {
  productName: string;
  brand: string;
  desiredPrice: string;
  referenceUrl: string;
};

function toEditForm(item: Recommendation): EditForm {
  return {
    productName: item.productName,
    brand: item.brand,
    desiredPrice: item.desiredPrice,
    referenceUrl: item.referenceUrl,
  };
}

function canEdit(item: Recommendation): boolean {
  return item.status === "new" || item.status === "reviewing";
}

export default function SellerRecommendList() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/seller/recommendations")
      .then((res) => (res.ok ? res.json() : { recommendations: [] }))
      .then((data) => setItems(data.recommendations ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const onSubmitted = () => load();
    window.addEventListener("seller-recommend-submitted", onSubmitted);
    return () => window.removeEventListener("seller-recommend-submitted", onSubmitted);
  }, []);

  const openEdit = (item: Recommendation) => {
    if (!canEdit(item)) return;
    setEditingId(item.id);
    setEditForm(toEditForm(item));
    setError("");
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setError("");
  };

  const handleSave = async () => {
    if (!editingId || !editForm) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/seller/recommendations/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "수정에 실패했습니다.");
      } else {
        setItems((prev) =>
          prev.map((item) =>
            item.id === editingId ? data.recommendation : item
          )
        );
        closeEdit();
      }
    } catch {
      setError("수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        아직 제출한 추천이 없습니다.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id} className="py-4 first:pt-0">
          {editingId === item.id && editForm ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">추천 수정</h4>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    상품명
                  </label>
                  <input
                    className={inputClass}
                    value={editForm.productName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, productName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    브랜드
                  </label>
                  <input
                    className={inputClass}
                    value={editForm.brand}
                    onChange={(e) =>
                      setEditForm({ ...editForm, brand: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    희망 판매가격
                  </label>
                  <input
                    className={inputClass}
                    value={editForm.desiredPrice}
                    onChange={(e) =>
                      setEditForm({ ...editForm, desiredPrice: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    참고 URL
                  </label>
                  <input
                    className={inputClass}
                    value={editForm.referenceUrl}
                    onChange={(e) =>
                      setEditForm({ ...editForm, referenceUrl: e.target.value })
                    }
                  />
                </div>
              </div>
              {error && (
                <p className="mt-3 text-sm text-red-600">{error}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  저장
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-white"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openEdit(item)}
              disabled={!canEdit(item)}
              className={`w-full rounded-xl text-left transition-colors ${
                canEdit(item)
                  ? "cursor-pointer hover:bg-slate-50"
                  : "cursor-default"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 px-1">
                <div>
                  <p className="font-medium text-slate-900">
                    {item.brand ? `[${item.brand}] ` : ""}
                    {item.productName}
                  </p>
                  {item.desiredPrice && (
                    <p className="mt-0.5 text-sm text-slate-500">
                      희망 판매가: {item.desiredPrice}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                  {canEdit(item) ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                      <Pencil className="h-3 w-3" />
                      클릭하여 수정
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">
                      {item.status === "adopted"
                        ? "업체 컨택 진행 중 — 수정 불가"
                        : "보류된 추천 — 수정 불가"}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${RECOMMENDATION_STATUS_COLORS[item.status]}`}
                >
                  {RECOMMENDATION_STATUS_LABELS[item.status]}
                </span>
              </div>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
