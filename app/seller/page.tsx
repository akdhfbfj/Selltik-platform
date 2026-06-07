import { redirect } from "next/navigation";
import { getRecommendationsByShopId } from "@/lib/db";
import { getOrdersByShop } from "@/lib/orders";
import { countPendingProductReviews } from "@/lib/products";
import { getSellerSession } from "@/lib/supabase/server-auth";
import { getShopByAuthUserId } from "@/lib/shops";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Download,
  MessageSquare,
  Package,
  Send,
  Sparkles,
} from "lucide-react";
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

  const [orders, pendingReviewCount, recommendations] = await Promise.all([
    getOrdersByShop(shop.id),
    countPendingProductReviews(shop.id),
    getRecommendationsByShopId(shop.id),
  ]);

  const orderDraft = orders.filter((o) => o.status === "draft").length;
  const orderPaid = orders.filter((o) => o.status === "paid").length;
  const orderExported = orders.filter((o) => o.status === "exported").length;
  const recReviewing = recommendations.filter(
    (r) => r.status === "new" || r.status === "reviewing"
  ).length;

  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.orderDate === today).length;

  const cards = [
    {
      href: "/seller/recommend",
      icon: Sparkles,
      iconClass: "text-emerald-600",
      borderClass: "border-emerald-200 hover:border-emerald-300",
      title: "신상품 추천",
      desc: "셀틱에 신상품 제안",
      badge:
        recReviewing > 0 ? `검토중 ${recReviewing}건` : undefined,
    },
    {
      href: "/seller/products",
      icon: Package,
      iconClass: "text-emerald-600",
      borderClass: "border-emerald-200 hover:border-emerald-300",
      title: "상품·공급가",
      desc: "판매가 · 문자 상품명",
      badge:
        pendingReviewCount > 0
          ? `확인 필요 ${pendingReviewCount}건`
          : undefined,
      badgeWarn: pendingReviewCount > 0,
    },
    {
      href: "/seller/outbound-sms",
      icon: Send,
      iconClass: "text-blue-600",
      borderClass: "border-blue-200 hover:border-blue-300",
      title: "① 안내 문자",
      desc: "상품 담기 · 문자 복사",
    },
    {
      href: "/seller/orders",
      icon: MessageSquare,
      iconClass: "text-emerald-600",
      borderClass: "border-emerald-200 hover:border-emerald-300",
      title: "② 답장·발주",
      desc: "답장 분석 · xlsx 출력",
      badge:
        orderPaid > 0 ? `발주 준비 ${orderPaid}건` : undefined,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">
          안녕하세요, {shop.name}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          오늘 발주일 기준 {todayOrders}건 · 전체 발주 {orders.length}건
        </p>
      </div>

      {(orderDraft > 0 || orderPaid > 0 || pendingReviewCount > 0) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {orderDraft > 0 && (
            <Link
              href="/seller/orders"
              className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm hover:bg-amber-100/80"
            >
              <Banknote className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">
                  입금 대기 {orderDraft}건
                </p>
                <p className="text-xs text-amber-700">입금확인 후 발주 준비</p>
              </div>
            </Link>
          )}
          {orderPaid > 0 && (
            <Link
              href="/seller/orders"
              className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm hover:bg-emerald-100/80"
            >
              <Download className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-900">
                  발주 준비 {orderPaid}건
                </p>
                <p className="text-xs text-emerald-700">xlsx 다운로드 가능</p>
              </div>
            </Link>
          )}
          {pendingReviewCount > 0 && (
            <Link
              href="/seller/products"
              className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm hover:bg-amber-100/80"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">
                  공급가 변경 {pendingReviewCount}건
                </p>
                <p className="text-xs text-amber-700">상품·공급가에서 확인</p>
              </div>
            </Link>
          )}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">발주 흐름</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-800">
            ① 안내 문자
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
            ② 답장·발주
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
            입금확인
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="rounded-full bg-slate-200 px-2.5 py-1 font-medium text-slate-700">
            xlsx 다운로드
          </span>
        </div>
        {orderExported > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            다운로드 완료 {orderExported}건
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`rounded-2xl border bg-white/60 p-5 shadow-sm transition ${card.borderClass}`}
          >
            <card.icon className={`h-8 w-8 ${card.iconClass}`} />
            <h3 className="mt-3 font-semibold text-slate-900">{card.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{card.desc}</p>
            {card.badge && (
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  card.badgeWarn
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {card.badge}
              </span>
            )}
          </Link>
        ))}
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
