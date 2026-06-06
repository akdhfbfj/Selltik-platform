import { redirect } from "next/navigation";
import { getSellerSession } from "@/lib/supabase/server-auth";
import { getShopByAuthUserId } from "@/lib/shops";
import { ClipboardList, MessageSquare, Package } from "lucide-react";
import Link from "next/link";

export default async function SellerHomePage() {
  const user = await getSellerSession();
  if (!user) {
    redirect("/seller/login");
  }

  const shop = await getShopByAuthUserId(user.id);
  if (!shop) {
    redirect("/seller/login");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">안녕하세요, {shop.name}</h2>
        <p className="mt-1 text-sm text-slate-500">
          발주·문자 기능은 순서대로 추가됩니다. 지금은 계정이 연결된 상태입니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Package className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">공급가·상품</h3>
          <p className="mt-1 text-sm text-slate-500">2단계에서 연동 예정</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <MessageSquare className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">문자 → 발주</h3>
          <p className="mt-1 text-sm text-slate-500">3단계: 붙여넣기 자동 기입</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ClipboardList className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">발주서 출력</h3>
          <p className="mt-1 text-sm text-slate-500">4단계: xlsx 다운로드</p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-900">
        신상품 추천은 로그인 없이{" "}
        <Link href="/recommend" className="font-medium underline">
          /recommend
        </Link>
        에서 계속 이용할 수 있습니다.
      </div>
    </div>
  );
}
