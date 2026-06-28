import { redirect } from "next/navigation";
import { getSellerDashboardStats } from "@/lib/seller-dashboard";
import {
  currentMonthKey,
  getSellerGrowthDashboard,
  type SellerGrowthDashboardData,
} from "@/lib/seller-growth";
import { getSellerSession } from "@/lib/supabase/server-auth";
import { getShopByAuthUserId } from "@/lib/shops";
import {
  AlertTriangle,
  Banknote,
  Bell,
  Download,
} from "lucide-react";
import Link from "next/link";
import SellerGrowthSection from "@/components/SellerGrowthSection";

export default async function SellerHomePage() {
  const user = await getSellerSession();
  if (!user) {
    redirect("/seller/login");
  }

  const shop = await getShopByAuthUserId(user.id);
  if (!shop) {
    redirect("/seller/login");
  }

  const monthKey = currentMonthKey();
  const [stats, growthInitial] = await Promise.all([
    getSellerDashboardStats(shop.id),
    getSellerGrowthDashboard(shop.id, monthKey),
  ]);

  const growthData: SellerGrowthDashboardData & { monthKey: string } = {
    monthKey,
    ...growthInitial,
  };

  const hasAlerts =
    stats.orderDraft > 0 ||
    stats.orderPaid > 0 ||
    stats.pendingReviewCount > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">
          안녕하세요, {shop.name}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          오늘 발주일 기준 {stats.todayOrders}건 · 전체 발주{" "}
          {stats.orderTotal}건
        </p>
      </div>

      {hasAlerts && (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-800">확인 필요</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {(stats.orderDraft > 0 ? 1 : 0) +
                (stats.orderPaid > 0 ? 1 : 0) +
                (stats.pendingReviewCount > 0 ? 1 : 0)}
              건
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.orderDraft > 0 && (
              <Link
                href="/seller/orders"
                className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm hover:bg-amber-100/80"
              >
                <Banknote className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900">
                    입금 대기 {stats.orderDraft}건
                  </p>
                  <p className="text-xs text-amber-700">입금확인 후 발주 준비</p>
                </div>
              </Link>
            )}
            {stats.orderPaid > 0 && (
              <Link
                href="/seller/orders"
                className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm hover:bg-emerald-100/80"
              >
                <Download className="h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">
                    발주 준비 {stats.orderPaid}건
                  </p>
                  <p className="text-xs text-emerald-700">xlsx 다운로드 가능</p>
                </div>
              </Link>
            )}
            {stats.pendingReviewCount > 0 && (
              <Link
                href="/seller/products"
                className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm hover:bg-amber-100/80"
              >
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900">
                    공급가 변경 {stats.pendingReviewCount}건
                  </p>
                  <p className="text-xs text-amber-700">상품·공급가에서 확인</p>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      <SellerGrowthSection initialData={growthData} />
    </div>
  );
}
