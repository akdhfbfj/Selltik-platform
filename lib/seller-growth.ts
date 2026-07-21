import { v4 as uuidv4 } from "uuid";
import { createServerClient } from "./supabase/server";
import {
  getShopOrderMetricsBundleForMonth,
  getShopOrderMetricsForDate,
  getShopOrderRevenueTrends,
  currentMonthKey,
} from "./seller-order-metrics";
import type {
  SellerBroadcast,
  SellerBroadcastInput,
  SellerGrowthStats,
  SellerReflectionEntry,
  SellerOrderDailyMetric,
  SellerOrderRevenueTrends,
} from "./types";

const EMPTY_REVENUE_TRENDS: SellerOrderRevenueTrends = {
  daily: [],
  weekly: [],
  monthly: [],
};

export type SellerGrowthDashboardData = {
  stats: SellerGrowthStats;
  broadcasts: SellerBroadcast[];
  reflections: SellerReflectionEntry[];
  orderDailyMetrics: SellerOrderDailyMetric[];
  orderRevenueTrends: SellerOrderRevenueTrends;
  dbError: string | null;
};

type DbRow = Record<string, unknown>;

function rowToBroadcast(row: DbRow): SellerBroadcast {
  return {
    id: row.id as string,
    shopId: row.shop_id as string,
    broadcastDate: row.broadcast_date as string,
    startTime: (row.start_time as string | null) ?? null,
    endTime: (row.end_time as string | null) ?? null,
    revenue: row.revenue as number,
    memo: row.memo as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e ?? "");
}

export function formatGrowthDbError(error: { message?: string }): string {
  const msg = error.message ?? "";
  if (
    msg.includes("does not exist") ||
    msg.includes("seller_broadcasts") ||
    msg.includes("seller_monthly_goals") ||
    msg.includes("seller_daily_goals")
  ) {
    return "방송 DB 설정이 필요합니다. Supabase SQL Editor에서 015·016 마이그레이션을 실행해 주세요.";
  }
  return msg || "요청 처리에 실패했습니다.";
}

export function appendReflection(
  existing: string,
  date: string,
  newNote: string
): string {
  const trimmed = newNote.trim();
  if (!trimmed) return existing.trim();
  const line = `[${date}] ${trimmed}`;
  const base = existing.trim();
  return base ? `${base}\n${line}` : line;
}

export function parseReflectionEntries(
  broadcasts: SellerBroadcast[]
): SellerReflectionEntry[] {
  const items: SellerReflectionEntry[] = [];
  for (const b of broadcasts) {
    if (!b.memo.trim()) continue;
    for (const line of b.memo.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.+)$/);
      items.push({
        broadcastId: b.id,
        date: match?.[1] ?? b.broadcastDate,
        text: match?.[2] ?? trimmed,
      });
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getBroadcastsForMonth(
  shopId: string,
  monthKey: string
): Promise<SellerBroadcast[]> {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const from = `${monthKey}-01`;
  const to = `${monthKey}-${String(lastDay).padStart(2, "0")}`;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seller_broadcasts")
    .select("*")
    .eq("shop_id", shopId)
    .gte("broadcast_date", from)
    .lte("broadcast_date", to)
    .order("broadcast_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToBroadcast);
}

export async function getAllBroadcastsForShop(
  shopId: string
): Promise<SellerBroadcast[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seller_broadcasts")
    .select("*")
    .eq("shop_id", shopId)
    .order("broadcast_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToBroadcast);
}

/** 복기 목록용 — memo 있는 행만 가볍게 조회 */
async function getBroadcastReflectionRows(
  shopId: string
): Promise<SellerBroadcast[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seller_broadcasts")
    .select("id, shop_id, broadcast_date, memo, revenue, start_time, end_time, created_at, updated_at")
    .eq("shop_id", shopId)
    .neq("memo", "")
    .order("broadcast_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToBroadcast);
}

async function safeValue<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function getRecentBroadcasts(
  shopId: string,
  limit = 4
): Promise<SellerBroadcast[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seller_broadcasts")
    .select("*")
    .eq("shop_id", shopId)
    .order("broadcast_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToBroadcast);
}

export async function getMonthlyTarget(
  shopId: string,
  monthKey: string
): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seller_monthly_goals")
    .select("target_revenue")
    .eq("shop_id", shopId)
    .eq("month_key", monthKey)
    .maybeSingle();
  if (error) throw error;
  return (data?.target_revenue as number | undefined) ?? 0;
}

export async function setMonthlyTarget(
  shopId: string,
  monthKey: string,
  targetRevenue: number
): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seller_monthly_goals")
    .upsert(
      {
        shop_id: shopId,
        month_key: monthKey,
        target_revenue: Math.max(0, Math.round(targetRevenue)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id,month_key" }
    )
    .select("target_revenue")
    .single();
  if (error) throw error;
  return data.target_revenue as number;
}

function currentDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDailyTarget(
  shopId: string,
  dateKey: string
): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seller_daily_goals")
    .select("target_revenue")
    .eq("shop_id", shopId)
    .eq("date_key", dateKey)
    .maybeSingle();
  if (error) throw error;
  return (data?.target_revenue as number | undefined) ?? 0;
}

export async function setDailyTarget(
  shopId: string,
  dateKey: string,
  targetRevenue: number
): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seller_daily_goals")
    .upsert(
      {
        shop_id: shopId,
        date_key: dateKey,
        target_revenue: Math.max(0, Math.round(targetRevenue)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id,date_key" }
    )
    .select("target_revenue")
    .single();
  if (error) throw error;
  return data.target_revenue as number;
}

export async function getBroadcastRevenueForDate(
  shopId: string,
  dateKey: string
): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seller_broadcasts")
    .select("revenue")
    .eq("shop_id", shopId)
    .eq("broadcast_date", dateKey);
  if (error) throw error;
  return (data ?? []).reduce((s, row) => s + (row.revenue as number), 0);
}

function emptyStats(monthKey: string, dateKey: string): SellerGrowthStats {
  return {
    monthKey,
    targetRevenue: 0,
    broadcastRevenueTotal: 0,
    achievementPct: 0,
    dateKey,
    dailyTargetRevenue: 0,
    dailyBroadcastRevenue: 0,
    dailyAchievementPct: 0,
    recentAvgRevenue: 0,
    broadcastCount: 0,
    orderSalesTotal: 0,
    orderMarginTotal: 0,
    orderCount: 0,
    dailyOrderSales: 0,
    dailyOrderMargin: 0,
  };
}

export async function getSellerGrowthStats(
  shopId: string,
  monthKey: string,
  monthBroadcasts?: SellerBroadcast[],
  orderMetrics?: {
    salesTotal: number;
    marginTotal: number;
    orderCount: number;
  }
): Promise<SellerGrowthStats> {
  const dateKey = currentDateKey();

  const orderBundle = orderMetrics
    ? {
        salesTotal: orderMetrics.salesTotal,
        marginTotal: orderMetrics.marginTotal,
        orderCount: orderMetrics.orderCount,
        dailyMetrics: [] as SellerOrderDailyMetric[],
      }
    : await safeValue(
        () => getShopOrderMetricsBundleForMonth(shopId, monthKey),
        {
          salesTotal: 0,
          marginTotal: 0,
          orderCount: 0,
          dailyMetrics: [] as SellerOrderDailyMetric[],
        }
      );

  const dateInSelectedMonth = dateKey.startsWith(`${monthKey}-`);
  let dailyOrderSales = 0;
  let dailyOrderMargin = 0;
  if (dateInSelectedMonth) {
    const dayMetric = orderBundle.dailyMetrics.find((m) => m.date === dateKey);
    dailyOrderSales = dayMetric?.sales ?? 0;
    dailyOrderMargin = dayMetric?.margin ?? 0;
  } else {
    const todayMetrics = await safeValue(
      () => getShopOrderMetricsForDate(shopId, dateKey),
      { sales: 0, margin: 0 }
    );
    dailyOrderSales = todayMetrics.sales;
    dailyOrderMargin = todayMetrics.margin;
  }

  const [
    broadcasts,
    targetRevenue,
    dailyTargetRevenue,
    recent,
  ] = await Promise.all([
    monthBroadcasts
      ? Promise.resolve(monthBroadcasts)
      : getBroadcastsForMonth(shopId, monthKey),
    safeValue(() => getMonthlyTarget(shopId, monthKey), 0),
    safeValue(() => getDailyTarget(shopId, dateKey), 0),
    safeValue(() => getRecentBroadcasts(shopId, 4), [] as SellerBroadcast[]),
  ]);

  const broadcastRevenueTotal = broadcasts.reduce((s, b) => s + b.revenue, 0);
  const recentAvgRevenue =
    recent.length > 0
      ? Math.round(recent.reduce((s, b) => s + b.revenue, 0) / recent.length)
      : 0;
  const achievementPct =
    targetRevenue > 0
      ? Math.round((orderBundle.salesTotal / targetRevenue) * 100)
      : 0;
  const dailyAchievementPct =
    dailyTargetRevenue > 0
      ? Math.round((dailyOrderSales / dailyTargetRevenue) * 100)
      : 0;

  return {
    monthKey,
    targetRevenue,
    broadcastRevenueTotal,
    achievementPct,
    dateKey,
    dailyTargetRevenue,
    dailyBroadcastRevenue: 0,
    dailyAchievementPct,
    recentAvgRevenue,
    broadcastCount: broadcasts.length,
    orderSalesTotal: orderBundle.salesTotal,
    orderMarginTotal: orderBundle.marginTotal,
    orderCount: orderBundle.orderCount,
    dailyOrderSales,
    dailyOrderMargin,
  };
}

export async function createBroadcast(
  shopId: string,
  input: SellerBroadcastInput
): Promise<SellerBroadcast> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const row = {
    id: `sb-${uuidv4()}`,
    shop_id: shopId,
    broadcast_date: input.broadcastDate,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    revenue: Math.max(0, Math.round(input.revenue)),
    memo: input.memo?.trim() ?? "",
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("seller_broadcasts")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToBroadcast(data as DbRow);
}

export async function updateBroadcast(
  shopId: string,
  id: string,
  input: Partial<SellerBroadcastInput>
): Promise<SellerBroadcast | null> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.broadcastDate !== undefined) patch.broadcast_date = input.broadcastDate;
  if (input.startTime !== undefined) patch.start_time = input.startTime || null;
  if (input.endTime !== undefined) patch.end_time = input.endTime || null;
  if (input.revenue !== undefined) {
    patch.revenue = Math.max(0, Math.round(input.revenue));
  }
  if (input.memo !== undefined) patch.memo = input.memo.trim();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seller_broadcasts")
    .update(patch)
    .eq("id", id)
    .eq("shop_id", shopId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? rowToBroadcast(data as DbRow) : null;
}

export async function deleteBroadcast(
  shopId: string,
  id: string
): Promise<boolean> {
  const supabase = createServerClient();
  const { error, count } = await supabase
    .from("seller_broadcasts")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("shop_id", shopId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getSellerGrowthDashboard(
  shopId: string,
  monthKey: string
): Promise<SellerGrowthDashboardData> {
  const dateKey = currentDateKey();
  const dateInSelectedMonth = dateKey.startsWith(`${monthKey}-`);
  let dbError: string | null = null;

  const [
    broadcastsResult,
    reflectionResult,
    orderResult,
    orderRevenueTrends,
    targetRevenue,
    dailyTargetRevenue,
    dailyBroadcastRevenueResult,
    recent,
  ] = await Promise.all([
    getBroadcastsForMonth(shopId, monthKey).catch((e) => {
      dbError = formatGrowthDbError({ message: getErrorMessage(e) });
      return [] as SellerBroadcast[];
    }),
    safeValue(() => getBroadcastReflectionRows(shopId), [] as SellerBroadcast[]),
    safeValue(() => getShopOrderMetricsBundleForMonth(shopId, monthKey), {
      salesTotal: 0,
      marginTotal: 0,
      orderCount: 0,
      dailyMetrics: [] as SellerOrderDailyMetric[],
    }),
    safeValue(
      () => getShopOrderRevenueTrends(shopId, dateKey),
      EMPTY_REVENUE_TRENDS
    ),
    safeValue(() => getMonthlyTarget(shopId, monthKey), 0),
    safeValue(() => getDailyTarget(shopId, dateKey), 0),
    dateInSelectedMonth
      ? Promise.resolve(null as number | null)
      : safeValue(() => getBroadcastRevenueForDate(shopId, dateKey), 0),
    safeValue(() => getRecentBroadcasts(shopId, 4), [] as SellerBroadcast[]),
  ]);

  const broadcasts = broadcastsResult;
  const reflections = parseReflectionEntries(reflectionResult);
  const orderDailyMetrics = orderResult.dailyMetrics;

  let dailyOrderSales = 0;
  let dailyOrderMargin = 0;
  if (dateInSelectedMonth) {
    const dayMetric = orderDailyMetrics.find((m) => m.date === dateKey);
    dailyOrderSales = dayMetric?.sales ?? 0;
    dailyOrderMargin = dayMetric?.margin ?? 0;
  } else {
    const todayMetrics = await safeValue(
      () => getShopOrderMetricsForDate(shopId, dateKey),
      { sales: 0, margin: 0 }
    );
    dailyOrderSales = todayMetrics.sales;
    dailyOrderMargin = todayMetrics.margin;
  }

  const dailyBroadcastRevenue = dateInSelectedMonth
    ? broadcasts
        .filter((b) => b.broadcastDate === dateKey)
        .reduce((s, b) => s + b.revenue, 0)
    : (dailyBroadcastRevenueResult ?? 0);

  const broadcastRevenueTotal = broadcasts.reduce((s, b) => s + b.revenue, 0);
  const recentAvgRevenue =
    recent.length > 0
      ? Math.round(recent.reduce((s, b) => s + b.revenue, 0) / recent.length)
      : 0;
  const achievementPct =
    targetRevenue > 0
      ? Math.round((orderResult.salesTotal / targetRevenue) * 100)
      : 0;
  const dailyAchievementPct =
    dailyTargetRevenue > 0
      ? Math.round((dailyOrderSales / dailyTargetRevenue) * 100)
      : 0;

  const stats: SellerGrowthStats = {
    monthKey,
    targetRevenue,
    broadcastRevenueTotal,
    achievementPct,
    dateKey,
    dailyTargetRevenue,
    dailyBroadcastRevenue,
    dailyAchievementPct,
    recentAvgRevenue,
    broadcastCount: broadcasts.length,
    orderSalesTotal: orderResult.salesTotal,
    orderMarginTotal: orderResult.marginTotal,
    orderCount: orderResult.orderCount,
    dailyOrderSales,
    dailyOrderMargin,
  };

  return {
    stats,
    broadcasts,
    reflections,
    orderDailyMetrics,
    orderRevenueTrends,
    dbError,
  };
}

export { currentMonthKey, currentDateKey };
