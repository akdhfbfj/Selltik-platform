import OrderSectionTabs from "@/components/OrderSectionTabs";
import { Construction } from "lucide-react";
import Link from "next/link";

export default function SellerReplyImportPage() {
  return (
    <>
      <OrderSectionTabs />
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <Construction className="mx-auto h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">
          XML 가져오기 — 기능 개발 중
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          SMS Backup & Restore XML 일괄 가져오기는 준비 중입니다. 지금은{" "}
          <strong>붙여넣기</strong>로 답장을 분석해 주세요.
        </p>
        <Link
          href="/seller/reply"
          className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          붙여넣기로 분석하기
        </Link>
      </div>
    </>
  );
}
