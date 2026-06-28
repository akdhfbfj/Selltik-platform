import OrderSectionTabs from "@/components/OrderSectionTabs";

export default function SellerOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[100rem] px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">발주</h2>
        <p className="mt-1 text-sm text-slate-500">
          답장 분석에서 임시 저장 → 입금 확인 → 최종 발주서(xlsx) 출력
        </p>
      </div>

      {children}
    </div>
  );
}
