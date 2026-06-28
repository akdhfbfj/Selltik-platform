import OrderSectionTabs from "@/components/OrderSectionTabs";

export default function SellerReplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">답장 분석</h2>
        <p className="mt-1 text-sm text-slate-500">
          ① 분석 → ② 양식 기입·저장 → ③ 목록 누적 → ④ 발주 탭으로 넘기기
        </p>
      </div>
      {children}
    </div>
  );
}
