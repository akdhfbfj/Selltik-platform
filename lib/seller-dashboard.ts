import { countPendingProductReviews } from "./products";
import { createServerClient } from "./supabase/server";

export interface SellerDashboardStats {
  orderTotal: number;
  orderDraft: number;
  orderPaid: number;
  orderExported: number;
  todayOrders: number;
  pendingReviewCount: number;
  recReviewing: number;
}

/** 셀러 홈용 — 전체 주문·추천 목록을 불러오지 않고 건수만 조회 */
export async function getSellerDashboardStats(
  shopId: string
): Promise<SellerDashboardStats> {
  const supabase = createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    orderTotalRes,
    orderDraftRes,
    orderPaidRes,
    orderExportedRes,
    todayOrdersRes,
    recReviewingRes,
    pendingReviewCount,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "draft"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "paid"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "exported"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("order_date", today),
    supabase
      .from("recommendations")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .in("status", ["new", "reviewing"]),
    countPendingProductReviews(shopId),
  ]);

  const throwIf = (error: { message?: string } | null) => {
    if (error) throw error;
  };
  throwIf(orderTotalRes.error);
  throwIf(orderDraftRes.error);
  throwIf(orderPaidRes.error);
  throwIf(orderExportedRes.error);
  throwIf(todayOrdersRes.error);
  throwIf(recReviewingRes.error);

  return {
    orderTotal: orderTotalRes.count ?? 0,
    orderDraft: orderDraftRes.count ?? 0,
    orderPaid: orderPaidRes.count ?? 0,
    orderExported: orderExportedRes.count ?? 0,
    todayOrders: todayOrdersRes.count ?? 0,
    pendingReviewCount,
    recReviewing: recReviewingRes.count ?? 0,
  };
}
