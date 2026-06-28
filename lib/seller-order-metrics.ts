import { getSellerProductViews } from "./products";
import { calcOrderPricing } from "./order-pricing";
import { createServerClient } from "./supabase/server";
import type { Order, SellerOrderDailyMetric, SellerProductView } from "./types";

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

export { monthRange };
