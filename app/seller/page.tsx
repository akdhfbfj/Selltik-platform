import { redirect } from "next/navigation";
import { getSellerSession } from "@/lib/supabase/server-auth";
import { getShopByAuthUserId } from "@/lib/shops";
import { ClipboardList, MessageSquare, Package, Sparkles } from "lucide-react";
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
          문자 붙여넣기로 발주 초안을 만들 수 있습니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/seller/recommend"
          className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm transition hover:border-emerald-300"
        >
          <Sparkles className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">신상품 추천</h3>
          <p className="mt-1 text-sm text-slate-500">로그인 연동 · 내역 확인</p>
        </Link>
        <Link
          href="/seller/products"
          className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm transition hover:border-emerald-300"
        >
          <Package className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">상품·공급가</h3>
          <p className="mt-1 text-sm text-slate-500">판매가 확인 · 문자 상품명 설정</p>
        </Link>
        <Link
          href="/seller/orders"
          className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm transition hover:border-emerald-300"
        >
          <MessageSquare className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">문자 → 발주</h3>
          <p className="mt-1 text-sm text-slate-500">문자 붙여넣기 · 발주 초안</p>
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ClipboardList className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">발주서 출력</h3>
          <p className="mt-1 text-sm text-slate-500">4단계: xlsx 다운로드</p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        계정 없이 추천하려면{" "}
        <Link href="/recommend" className="font-medium text-emerald-700 underline">
          /recommend
        </Link>
        (쇼핑몰 이름 직접 입력)도 이용할 수 있습니다.
      </div>
    </div>
  );
}
