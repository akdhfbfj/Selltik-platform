"use client";

import { useState } from "react";
import type { RecommendationInput } from "@/lib/types";
import { CheckCircle2, Loader2 } from "lucide-react";

const emptyForm: RecommendationInput = {
  productName: "",
  brand: "",
  referenceUrl: "",
  sellerName: "",
};

export default function RecommendForm() {
  const [form, setForm] = useState<RecommendationInput>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const update = (field: keyof RecommendationInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productName.trim()) {
      setError("상품명을 입력해주세요.");
      return;
    }
    if (!form.sellerName.trim()) {
      setError("쇼핑몰 이름을 입력해주세요.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "등록 실패");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

  if (done) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        <h2 className="mt-4 text-xl font-bold text-slate-900">추천이 접수되었습니다</h2>
        <p className="mt-2 text-sm text-slate-500">
          셀틱 팀에서 검토 후 진행합니다.
        </p>
        <button
          onClick={() => {
            setDone(false);
            setForm({ ...emptyForm });
          }}
          className="mt-6 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          다른 상품 추천하기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            상품명 <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            value={form.productName}
            onChange={(e) => update("productName", e.target.value)}
            placeholder=""
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            브랜드
          </label>
          <input
            className={inputClass}
            value={form.brand}
            onChange={(e) => update("brand", e.target.value)}
            placeholder="예: OO푸드"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            쇼핑몰 이름 <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            value={form.sellerName}
            onChange={(e) => update("sellerName", e.target.value)}
            placeholder="셀틱"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            참고 URL
          </label>
          <input
            className={inputClass}
            value={form.referenceUrl}
            onChange={(e) => update("referenceUrl", e.target.value)}
            placeholder="상품 페이지 링크 (선택)"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:min-w-[160px]"
      >
        {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "추천 제출"}
      </button>
    </form>
  );
}
