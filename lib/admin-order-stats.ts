import { createServerClient } from "./supabase/server";
import type { OrderStatus } from "./types";

type DbOrder = {
  id: string;
  shop_id: string;
  product_id: string | null;
  order_date: string;
  product_name: string;
  quantity: number;
  supply_total: number;
  celtic_deposit_amount: number | null;
  status: OrderStatus;
  shops?: { name: string } | { name: string }[] | null;
};

export interface AdminOrderRow {
  id: string;
  shopId: string;
  shopName: string;
  orderDate: string;
  productName: string;
  quantity: number;
  status: OrderStatus;
  celticDeposit: number;
  customerSales: number;
  sellerMargin: number;
}

export interface AdminShopOrderSummary {
  shopId: string;
  shopName: string;
  orderCount: number;
  confirmedCount: number;
  celticDepositTotal: number;
  customerSalesTotal: number;
  sellerMarginTotal: number;
  lastOrderDate: string | null;
}

export interface AdminOrderStats {
  from: string;
  to: string;
  totals: {
    orderCount: number;
    confirmedCount: number;
    draftCount: number;
    celticDepositTotal: number;
    customerSalesTotal: number;
    sellerMarginTotal: number;
  };
  byShop: AdminShopOrderSummary[];
  byDate: { date: string; count: number; celticTotal: number }[];
}

const CONFIRMED_STATUSES: OrderStatus[] = ["paid", "exported", "confirmed"];

function shopNameFromRow(row: DbOrder): string {
  const s = row.shops;
  if (!s) return "알 수 없음";
  if (Array.isArray(s)) return s[0]?.name ?? "알 수 없음";
  return s.name;
}

function enrichOrder(
  row: DbOrder,
  consumerByProduct: Map<string, number>
): AdminOrderRow {
  const celtic = row.celtic_deposit_amount ?? row.supply_total ?? 0;
  const unitConsumer = row.product_id
    ? (consumerByProduct.get(row.product_id) ?? 0)
    : 0;
  const customerSales = unitConsumer * row.quantity;
  const sellerMargin = Math.max(0, customerSales - celtic);

  return {
    id: row.id,
    shopId: row.shop_id,
    shopName: shopNameFromRow(row),
    orderDate: row.order_date,
    productName: row.product_name,
    quantity: row.quantity,
    status: row.status,
    celticDeposit: celtic,
    customerSales,
    sellerMargin: customerSales > 0 ? customerSales - celtic : 0,
  };
}

export async function getAdminOrderStats(
  from: string,
  to: string
): Promise<AdminOrderStats> {
  const supabase = createServerClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, shop_id, product_id, order_date, product_name, quantity, supply_total, celtic_deposit_amount, status, shops(name)"
    )
    .eq("hidden_from_admin", false)
    .gte("order_date", from)
    .lte("order_date", to)
    .order("order_date", { ascending: false });

  if (error) throw error;

  const rows = (orders ?? []) as DbOrder[];
  const productIds = [
    ...new Set(rows.map((r) => r.product_id).filter(Boolean)),
  ] as string[];

  const consumerByProduct = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("master_products")
      .select("id, consumer_price")
      .in("id", productIds);
    for (const p of products ?? []) {
      consumerByProduct.set(p.id as string, p.consumer_price as number);
    }
  }

  const enriched = rows.map((r) => enrichOrder(r, consumerByProduct));

  const totals = {
    orderCount: enriched.length,
    confirmedCount: 0,
    draftCount: 0,
    celticDepositTotal: 0,
    customerSalesTotal: 0,
    sellerMarginTotal: 0,
  };

  const shopMap = new Map<string, AdminShopOrderSummary>();
  const dateMap = new Map<string, { count: number; celticTotal: number }>();

  for (const o of enriched) {
    if (o.status === "draft") totals.draftCount++;
    const confirmed = CONFIRMED_STATUSES.includes(o.status);
    if (confirmed) {
      totals.confirmedCount++;
      totals.celticDepositTotal += o.celticDeposit;
      totals.customerSalesTotal += o.customerSales;
      totals.sellerMarginTotal += o.sellerMargin;
    }

    const shop =
      shopMap.get(o.shopId) ??
      ({
        shopId: o.shopId,
        shopName: o.shopName,
        orderCount: 0,
        confirmedCount: 0,
        celticDepositTotal: 0,
        customerSalesTotal: 0,
        sellerMarginTotal: 0,
        lastOrderDate: null,
      } satisfies AdminShopOrderSummary);

    shop.orderCount++;
    if (confirmed) {
      shop.confirmedCount++;
      shop.celticDepositTotal += o.celticDeposit;
      shop.customerSalesTotal += o.customerSales;
      shop.sellerMarginTotal += o.sellerMargin;
    }
    if (!shop.lastOrderDate || o.orderDate > shop.lastOrderDate) {
      shop.lastOrderDate = o.orderDate;
    }
    shopMap.set(o.shopId, shop);

    const dateEntry = dateMap.get(o.orderDate) ?? { count: 0, celticTotal: 0 };
    dateEntry.count++;
    if (confirmed) dateEntry.celticTotal += o.celticDeposit;
    dateMap.set(o.orderDate, dateEntry);
  }

  return {
    from,
    to,
    totals,
    byShop: [...shopMap.values()].sort(
      (a, b) => b.celticDepositTotal - a.celticDepositTotal
    ),
    byDate: [...dateMap.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14),
  };
}

export async function getAdminOrderList(
  from: string,
  to: string,
  shopId?: string
): Promise<AdminOrderRow[]> {
  const supabase = createServerClient();

  let query = supabase
    .from("orders")
    .select(
      "id, shop_id, product_id, order_date, product_name, quantity, supply_total, celtic_deposit_amount, status, shops(name)"
    )
    .eq("hidden_from_admin", false)
    .gte("order_date", from)
    .lte("order_date", to)
    .order("order_date", { ascending: false })
    .limit(200);

  if (shopId) query = query.eq("shop_id", shopId);

  const { data: orders, error } = await query;
  if (error) throw error;

  const rows = (orders ?? []) as DbOrder[];
  const productIds = [
    ...new Set(rows.map((r) => r.product_id).filter(Boolean)),
  ] as string[];

  const consumerByProduct = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("master_products")
      .select("id, consumer_price")
      .in("id", productIds);
    for (const p of products ?? []) {
      consumerByProduct.set(p.id as string, p.consumer_price as number);
    }
  }

  return rows.map((r) => enrichOrder(r, consumerByProduct));
}
