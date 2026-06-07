import { redirect } from "next/navigation";
import { getSellerSession } from "@/lib/supabase/server-auth";
import { getShopByAuthUserId } from "@/lib/shops";
import { MessageSquare, Package, Send, Sparkles } from "lucide-react";
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
          안내 문자 보내기와 답장·발주를 각각 진행할 수 있습니다.
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
          href="/seller/outbound-sms"
          className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 shadow-sm transition hover:border-blue-300"
        >
          <Send className="h-8 w-8 text-blue-600" />
          <h3 className="mt-3 font-semibold text-slate-900">① 안내 문자</h3>
          <p className="mt-1 text-sm text-slate-500">상품 담기 · 문자 복사</p>
        </Link>
        <Link
          href="/seller/orders"
          className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm transition hover:border-emerald-300"
        >
          <MessageSquare className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">② 답장·발주</h3>
          <p className="mt-1 text-sm text-slate-500">답장 분석 · 저장 · xlsx</p>
        </Link>
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
