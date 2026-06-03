"use client";

import { useCallback, useEffect, useState } from "react";
import type { Recommendation, RecommendationStatus } from "@/lib/types";
import { RECOMMENDATION_STATUS_LABELS } from "@/lib/types";
import { buildContactPrefillFromRecommendation } from "@/lib/utils";
import AdminNav from "@/components/AdminNav";
import RecommendationCard from "@/components/RecommendationCard";
import ContactForm from "@/components/ContactForm";
import type { ContactInput } from "@/lib/types";
import { Inbox, X } from "lucide-react";

export default function InboxPage() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus | "all">("all");
  const [converting, setConverting] = useState<Recommendation | null>(null);
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> }>({
    total: 0,
    byStatus: {},
  });

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/recommendations");
    const data = await res.json();
    setItems(data.recommendations);
    setStats(data.stats);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered =
    statusFilter === "all"
      ? items
      : items.filter((i) => i.status === statusFilter);

  const handleStatusChange = async (id: string, status: RecommendationStatus) => {
    await fetch(`/api/recommendations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchItems();
  };

  const handleConvertSuccess = async () => {
    if (converting) {
      await fetch(`/api/recommendations/${converting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "adopted" }),
      });
    }
    setConverting(null);
    fetchItems();
  };

  const prefill: Partial<ContactInput> | undefined = converting
    ? buildContactPrefillFromRecommendation(converting)
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <AdminNav />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">셀러 추천함</h2>
          <p className="mt-1 text-sm text-slate-500">
            셀러가 올린 신상품 추천을 검토하고, 업체 컨택으로 전환하세요
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <FilterChip
            label={`전체 ${stats.total}`}
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          {(Object.keys(RECOMMENDATION_STATUS_LABELS) as RecommendationStatus[]).map(
            (status) => (
              <FilterChip
                key={status}
                label={`${RECOMMENDATION_STATUS_LABELS[status]} ${stats.byStatus[status] || 0}`}
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              />
            )
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 py-20 text-center">
            <Inbox className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 font-medium text-slate-600">
              {items.length === 0 ? "아직 추천이 없습니다" : "해당 상태의 추천이 없습니다"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              셀러에게 <code className="rounded bg-slate-100 px-1">/recommend</code> 링크를 공유하세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <RecommendationCard
                key={item.id}
                item={item}
                onStatusChange={handleStatusChange}
                onConvert={setConverting}
              />
            ))}
          </div>
        )}
      </main>

      {converting && prefill && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">업체 컨택 등록</h2>
                <p className="text-xs text-slate-500">
                  셀러 추천 → {converting.productName}
                </p>
              </div>
              <button
                onClick={() => setConverting(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ContactForm
              contact={null}
              prefill={prefill}
              recommendationId={converting.id}
              onSuccess={handleConvertSuccess}
              onCancel={() => setConverting(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
