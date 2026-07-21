import { getSellerProductViews } from "./products";
import { calcOrderPricing } from "./order-pricing";
import { createServerClient } from "./supabase/server";
import type {
  Order,
  SellerOrderDailyMetric,
  SellerOrderPeriodMetric,
  SellerOrderRevenueTrends,
  SellerProductView,
} from "./types";

const ORDER_METRICS_COLUMNS =
  "product_id, product_name, quantity, postal_code, address, is_remote_area, celtic_deposit_amount, supply_total, order_date";

type OrderMetricsRow = Pick<
  Order,
  | "productId"
  | "productName"
  | "quantity"
  | "postalCode"
  | "address"
  | "isRemoteArea"
  | "celticDepositAmount"
  | "supplyTotal"
  | "orderDate"
>;

function rowToOrderMetricsRow(row: Record<string, unknown>): OrderMetricsRow {
  return {
    productId: (row.product_id as string) ?? null,
    productName: row.product_name as string,
    quantity: row.quantity as number,
    postalCode: row.postal_code as string,
    address: row.address as string,
    isRemoteArea: row.is_remote_area as boolean,
    celticDepositAmount: (row.celtic_deposit_amount as number) ?? null,
    supplyTotal: row.supply_total as number,
    orderDate: row.order_date as string,
  };
}

function buildProductLookup(products: SellerProductView[]) {
  const byId = new Map<string, SellerProductView>();
  const byOfficial = new Map<string, SellerProductView>();
  const bySms = new Map<string, SellerProductView>();
  for (const p of products) {
    byId.set(p.id, p);
    byOfficial.set(p.officialName.trim(), p);
    const sms = p.smsName.trim();
    if (sms) bySms.set(sms, p);
  }
  return { byId, byOfficial, bySms };
}

function findProductForMetricsRow(
  order: OrderMetricsRow,
  lookup: ReturnType<typeof buildProductLookup>
): SellerProductView | null {
  if (order.productId) {
    const byId = lookup.byId.get(order.productId);
    if (byId) return byId;
  }
  const name = order.productName.trim();
  return lookup.byOfficial.get(name) ?? lookup.bySms.get(name) ?? null;
}

function metricsRowPriceFields(
  order: OrderMetricsRow,
  lookup: ReturnType<typeof buildProductLookup>
): { salePrice: number; margin: number } {
  const product = findProductForMetricsRow(order, lookup);
  const pricing = calcOrderPricing(
    product,
    order.quantity,
    order.postalCode,
    order.address,
    order.isRemoteArea
  );
  const celticDeposit = order.celticDepositAmount ?? order.supplyTotal;
  return {
    salePrice: pricing.customerDepositAmount,
    margin: pricing.customerDepositAmount - celticDeposit,
  };
}

function monthRange(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export type ShopOrderMetricsBundle = {
  salesTotal: number;
  marginTotal: number;
  orderCount: number;
  dailyMetrics: SellerOrderDailyMetric[];
};

/** 해당 월 확정 발주 — 합계·일별 누적을 한 번의 조회로 계산 */
export async function getShopOrderMetricsBundleForMonth(
  shopId: string,
  monthKey: string
): Promise<ShopOrderMetricsBundle> {
  const { from, to } = monthRange(monthKey);
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_METRICS_COLUMNS)
    .eq("shop_id", shopId)
    .gte("order_date", from)
    .lte("order_date", to)
    .in("status", ["paid", "exported"]);
  if (error) throw error;

  const orders = (data ?? []).map((row) => rowToOrderMetricsRow(row as never));
  const byDate = new Map<string, { sales: number; margin: number }>();

  if (orders.length > 0) {
    const products = await getSellerProductViews(shopId);
    const lookup = buildProductLookup(products);
    for (const order of orders) {
      const p = metricsRowPriceFields(order, lookup);
      const cur = byDate.get(order.orderDate) ?? { sales: 0, margin: 0 };
      cur.sales += p.salePrice;
      cur.margin += p.margin;
      byDate.set(order.orderDate, cur);
    }
  }

  let salesTotal = 0;
  let marginTotal = 0;
  let cumulativeSales = 0;
  let cumulativeMargin = 0;
  const dailyMetrics: SellerOrderDailyMetric[] = [];

  for (let d = 1; d <= lastDay; d++) {
    const date = `${monthKey}-${String(d).padStart(2, "0")}`;
    const dayData = byDate.get(date) ?? { sales: 0, margin: 0 };
    salesTotal += dayData.sales;
    marginTotal += dayData.margin;
    cumulativeSales += dayData.sales;
    cumulativeMargin += dayData.margin;
    dailyMetrics.push({
      date,
      day: d,
      sales: dayData.sales,
      margin: dayData.margin,
      cumulativeSales,
      cumulativeMargin,
    });
  }

  return {
    salesTotal,
    marginTotal,
    orderCount: orders.length,
    dailyMetrics,
  };
}

async function sumOrderMetricsForRows(
  shopId: string,
  orders: OrderMetricsRow[]
): Promise<{ sales: number; margin: number }> {
  if (orders.length === 0) return { sales: 0, margin: 0 };
  const products = await getSellerProductViews(shopId);
  const lookup = buildProductLookup(products);
  let sales = 0;
  let margin = 0;
  for (const order of orders) {
    const p = metricsRowPriceFields(order, lookup);
    sales += p.salePrice;
    margin += p.margin;
  }
  return { sales, margin };
}

/** 특정일 발주 확정(paid/exported) 판매·마진 */
export async function getShopOrderMetricsForDate(
  shopId: string,
  dateKey: string
): Promise<{ sales: number; margin: number }> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_METRICS_COLUMNS)
    .eq("shop_id", shopId)
    .eq("order_date", dateKey)
    .in("status", ["paid", "exported"]);
  if (error) throw error;
  const orders = (data ?? []).map((row) => rowToOrderMetricsRow(row as never));
  return sumOrderMetricsForRows(shopId, orders);
}

/** 해당 월 확정 발주(paid/exported) 판매가·마진 합계 */
export async function getShopOrderMetricsForMonth(
  shopId: string,
  monthKey: string
): Promise<{ salesTotal: number; marginTotal: number; orderCount: number }> {
  const bundle = await getShopOrderMetricsBundleForMonth(shopId, monthKey);
  return {
    salesTotal: bundle.salesTotal,
    marginTotal: bundle.marginTotal,
    orderCount: bundle.orderCount,
  };
}

/** 해당 월 일별 + 누적 판매·마진 (발주 확정 기준) */
export async function getShopOrderDailyMetricsForMonth(
  shopId: string,
  monthKey: string
): Promise<SellerOrderDailyMetric[]> {
  const bundle = await getShopOrderMetricsBundleForMonth(shopId, monthKey);
  return bundle.dailyMetrics;
}

/** YYYY-MM-DD + delta days (local noon, timezone-safe enough for date keys) */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-start week key for a date */
export function weekStartKey(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatMd(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}년 ${Number(m)}월`;
}

/**
 * 일별 Map → 최근 일/주/월 기간 시리즈 (순수 함수, 테스트용).
 * dailyDays=14, weekCount=8, monthCount=6 기본.
 */
export function buildRevenueTrendsFromDailyMap(
  byDate: Map<string, { sales: number; margin: number }>,
  todayKey: string,
  opts?: { dailyDays?: number; weekCount?: number; monthCount?: number }
): SellerOrderRevenueTrends {
  const dailyDays = opts?.dailyDays ?? 14;
  const weekCount = opts?.weekCount ?? 8;
  const monthCount = opts?.monthCount ?? 6;

  const daily: SellerOrderPeriodMetric[] = [];
  for (let i = dailyDays - 1; i >= 0; i--) {
    const date = shiftDateKey(todayKey, -i);
    const v = byDate.get(date) ?? { sales: 0, margin: 0 };
    daily.push({
      key: date,
      label: formatMd(date),
      sales: v.sales,
      margin: v.margin,
    });
  }

  const thisWeekStart = weekStartKey(todayKey);
  const weekly: SellerOrderPeriodMetric[] = [];
  for (let w = weekCount - 1; w >= 0; w--) {
    const start = shiftDateKey(thisWeekStart, -w * 7);
    const end = shiftDateKey(start, 6);
    let sales = 0;
    let margin = 0;
    for (let d = 0; d < 7; d++) {
      const date = shiftDateKey(start, d);
      if (date > todayKey) break;
      const v = byDate.get(date) ?? { sales: 0, margin: 0 };
      sales += v.sales;
      margin += v.margin;
    }
    weekly.push({
      key: start,
      label: `${formatMd(start)}–${formatMd(end > todayKey ? todayKey : end)}`,
      sales,
      margin,
    });
  }

  const [ty, tm] = todayKey.split("-").map(Number);
  const monthly: SellerOrderPeriodMetric[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const dt = new Date(ty, tm - 1 - i, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    const lastDay = new Date(y, m, 0).getDate();
    let sales = 0;
    let margin = 0;
    for (let d = 1; d <= lastDay; d++) {
      const date = `${monthKey}-${String(d).padStart(2, "0")}`;
      if (date > todayKey) break;
      const v = byDate.get(date) ?? { sales: 0, margin: 0 };
      sales += v.sales;
      margin += v.margin;
    }
    monthly.push({
      key: monthKey,
      label: formatMonthLabel(monthKey),
      sales,
      margin,
    });
  }

  return { daily, weekly, monthly };
}

async function loadConfirmedOrdersByDate(
  shopId: string,
  from: string,
  to: string
): Promise<Map<string, { sales: number; margin: number }>> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_METRICS_COLUMNS)
    .eq("shop_id", shopId)
    .gte("order_date", from)
    .lte("order_date", to)
    .in("status", ["paid", "exported"]);
  if (error) throw error;

  const orders = (data ?? []).map((row) => rowToOrderMetricsRow(row as never));
  const byDate = new Map<string, { sales: number; margin: number }>();
  if (orders.length === 0) return byDate;

  const products = await getSellerProductViews(shopId);
  const lookup = buildProductLookup(products);
  for (const order of orders) {
    const p = metricsRowPriceFields(order, lookup);
    const cur = byDate.get(order.orderDate) ?? { sales: 0, margin: 0 };
    cur.sales += p.salePrice;
    cur.margin += p.margin;
    byDate.set(order.orderDate, cur);
  }
  return byDate;
}

/** 홈 차트용 최근 일/주/월 기간 시리즈 */
export async function getShopOrderRevenueTrends(
  shopId: string,
  todayKey = new Date().toISOString().slice(0, 10)
): Promise<SellerOrderRevenueTrends> {
  const from = shiftDateKey(todayKey, -(6 * 31));
  const byDate = await loadConfirmedOrdersByDate(shopId, from, todayKey);
  return buildRevenueTrendsFromDailyMap(byDate, todayKey);
}

export { monthRange };
