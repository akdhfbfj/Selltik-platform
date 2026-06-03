"use client";

import type { Recommendation, RecommendationStatus } from "@/lib/types";
import {
  RECOMMENDATION_STATUS_COLORS,
  RECOMMENDATION_STATUS_LABELS,
} from "@/lib/types";
import { ArrowRight, ExternalLink, Store, X } from "lucide-react";
import { useState } from "react";

interface Props {
  item: Recommendation;
  onStatusChange: (id: string, status: RecommendationStatus) => void;
  onConvert: (item: Recommendation) => void;
}

export default function RecommendationCard({
  item,
  onStatusChange,
  onConvert,
}: Props) {
  const [showImages, setShowImages] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {item.brand ? `[${item.brand}] ` : ""}
                {item.productName}
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${RECOMMENDATION_STATUS_COLORS[item.status]}`}
              >
                {RECOMMENDATION_STATUS_LABELS[item.status]}
              </span>
            </div>
          </div>
          {item.images.length > 0 && (
            <button
              onClick={() => setShowImages(true)}
              className="shrink-0 overflow-hidden rounded-lg border border-slate-200"
            >
              <img
                src={item.images[0]}
                alt=""
                className="h-16 w-16 object-cover"
              />
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Store className="h-3 w-3" />
            {item.sellerName}
          </span>
          <span>{new Date(item.createdAt).toLocaleDateString("ko-KR")}</span>
          {item.referenceUrl && (
            <a
              href={item.referenceUrl.startsWith("http") ? item.referenceUrl : `https://${item.referenceUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-brand-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              참고 링크
            </a>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {item.status !== "adopted" && (
            <button
              onClick={() => onConvert(item)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              컨택 건으로 전환
            </button>
          )}
          {item.status === "new" && (
            <button
              onClick={() => onStatusChange(item.id, "reviewing")}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              검토중
            </button>
          )}
          {item.status !== "rejected" && item.status !== "adopted" && (
            <button
              onClick={() => onStatusChange(item.id, "rejected")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              보류
            </button>
          )}
        </div>
      </div>

      {showImages && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowImages(false)}
        >
          <div
            className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">{item.productName}</h3>
              <button onClick={() => setShowImages(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              {item.images.map((src) => (
                <img key={src} src={src} alt="" className="w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
