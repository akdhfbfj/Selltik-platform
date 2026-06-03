import RecommendForm from "@/components/RecommendForm";

export default function RecommendPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10">
        <div className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-2xl font-bold text-slate-900">신상품 추천</h1>
          <p className="mt-1 text-sm text-slate-500">
            상품 정보만 입력해주세요. 빠르게 컨택 후 안내드리겠습니다.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <RecommendForm />
        </div>
      </div>
    </div>
  );
}
