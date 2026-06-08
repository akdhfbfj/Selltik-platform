import OrderSectionTabs from "@/components/OrderSectionTabs";

export default function SellerOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">발주</h2>
        <p className="mt-1 text-sm text-slate-500">
          고객 답장 → 저장 → 입금확인 → xlsx 출력
        </p>
      </div>

      <OrderSectionTabs />

      {children}
    </div>
  );
}
