"use client";

import { useEffect, useState } from "react";
import type { Recommendation } from "@/lib/types";
import { RECOMMENDATION_STATUS_COLORS, RECOMMENDATION_STATUS_LABELS } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function SellerRecommendList() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

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
          <div className="flex flex-wrap items-start justify-between gap-2">
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
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${RECOMMENDATION_STATUS_COLORS[item.status]}`}
            >
              {RECOMMENDATION_STATUS_LABELS[item.status]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
