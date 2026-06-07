import { v4 as uuidv4 } from "uuid";
import type { Order, OrderDraftPreview, OrderInput, SellerProductView } from "./types";
import type { ParsedOrderSms } from "./parse-order-sms";
import { calcOrderPricing } from "./order-pricing";
import { getSellerProductViews } from "./products";
import { saveSmsParseSample } from "./sms-parse-samples";
import { createServerClient } from "./supabase/server";

type DbRow = Record<string, unknown>;

function rowToOrder(row: DbRow): Order {
  return {
    id: row.id as string,
    shopId: row.shop_id as string,
    productId: (row.product_id as string) ?? null,
    customerOrderDate:
      (row.customer_order_date as string) ?? (row.order_date as string),
    orderDate: row.order_date as string,
    productName: row.product_name as string,
    quantity: row.quantity as number,
    ordererName: row.orderer_name as string,
    recipientName: row.recipient_name as string,
    contactPhone: row.contact_phone as string,
    contactPhone2: row.contact_phone2 as string,
    postalCode: row.postal_code as string,
    address: row.address as string,
    shippingMemo: row.shipping_memo as string,
    purchasePrice: row.purchase_price as number,
    shippingFee: row.shipping_fee as number,
    supplyTotal: row.supply_total as number,
    celticDepositAmount: (row.celtic_deposit_amount as number) ?? null,
    isRemoteArea: row.is_remote_area as boolean,
    rawSmsText: row.raw_sms_text as string,
    status: row.status as Order["status"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function normalizeName(s: string): string {
  return s.replace(/\s/g, "").toLowerCase();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function matchProductBySmsName(
  productName: string,
  products: SellerProductView[]
): {
  product: SellerProductView | null;
  matchedBy: OrderDraftPreview["productMatch"]["matchedBy"];
} {
  const query = normalizeName(productName);
  if (!query) return { product: null, matchedBy: "none" };

  const aliasHit = products.find(
    (p) => p.smsName && normalizeName(p.smsName) === query
  );
  if (aliasHit) return { product: aliasHit, matchedBy: "sms_alias" };

  const aliasContains = products.find(
    (p) =>
      p.smsName &&
      (normalizeName(p.smsName).includes(query) ||
        query.includes(normalizeName(p.smsName)))
  );
  if (aliasContains) return { product: aliasContains, matchedBy: "sms_alias" };

  const officialHit = products.find(
    (p) => normalizeName(p.officialName) === query
  );
  if (officialHit) return { product: officialHit, matchedBy: "official_name" };

  const officialContains = products.find(
    (p) =>
      normalizeName(p.officialName).includes(query) ||
      query.includes(normalizeName(p.officialName))
  );
  if (officialContains)
    return { product: officialContains, matchedBy: "official_name" };

  return { product: null, matchedBy: "none" };
}

export async function buildOrderDraft(
  shopId: string,
  parsed: ParsedOrderSms,
  rawSmsText: string
): Promise<OrderDraftPreview> {
  const products = await getSellerProductViews(shopId);
  const { product, matchedBy } = matchProductBySmsName(
    parsed.productName,
    products
  );

  const pricing = calcOrderPricing(
    product,
    parsed.quantity,
    parsed.postalCode,
    parsed.address,
    false
  );

  const today = todayIso();
  return {
    customerOrderDate: today,
    orderDate: today,
    productId: product?.id ?? null,
    productName: product?.officialName ?? parsed.productName,
    quantity: parsed.quantity,
    ordererName: parsed.ordererName,
    recipientName: parsed.recipientName || parsed.ordererName,
    contactPhone: parsed.contactPhone,
    contactPhone2: parsed.contactPhone2,
    postalCode: parsed.postalCode,
    address: parsed.address,
    shippingMemo: parsed.shippingMemo,
    purchasePrice: pricing.purchasePrice,
    shippingFee: pricing.shippingFee,
    supplyTotal: pricing.supplyTotal,
    isRemoteArea: pricing.isRemoteArea,
    rawSmsText,
    status: "draft",
    productMatch: {
      productId: product?.id ?? null,
      officialName: product?.officialName ?? null,
      matchedBy,
      consumerPrice: product?.consumerPrice ?? 0,
    },
    celticDepositAmount: pricing.celticDepositAmount,
    autoParsed: { ...parsed },
  };
}

function toDbRow(
  input: OrderInput & { celticDepositAmount?: number },
  shopId: string,
  now: string
) {
  return {
    shop_id: shopId,
    product_id: input.productId ?? null,
    customer_order_date:
      input.customerOrderDate?.slice(0, 10) ||
      input.orderDate?.slice(0, 10) ||
      todayIso(),
    order_date: input.orderDate?.slice(0, 10) || todayIso(),
    product_name: input.productName.trim(),
    quantity: input.quantity,
    orderer_name: input.ordererName.trim(),
    recipient_name: input.recipientName.trim(),
    contact_phone: input.contactPhone.trim(),
    contact_phone2: input.contactPhone2?.trim() ?? "",
    postal_code: input.postalCode.trim(),
    address: input.address.trim(),
    shipping_memo: input.shippingMemo?.trim() ?? "",
    purchase_price: input.purchasePrice,
    shipping_fee: input.shippingFee,
    supply_total: input.supplyTotal,
    celtic_deposit_amount: input.celticDepositAmount ?? input.supplyTotal,
    is_remote_area: input.isRemoteArea,
    raw_sms_text: input.rawSmsText?.trim() ?? "",
    status: input.status ?? "draft",
    updated_at: now,
  };
}

export function formatOrderDbError(error: { message?: string }): string {
  const msg = error.message ?? "";
  if (msg.includes("orders") && msg.includes("does not exist")) {
    return "DB 테이블이 없습니다. Supabase SQL Editor에서 005_orders.sql을 실행하세요.";
  }
  if (msg.includes("customer_order_date")) {
    return "DB 컬럼이 없습니다. Supabase SQL Editor에서 008_order_customer_date.sql을 실행하세요.";
  }
  return msg || "DB 오류가 발생했습니다.";
}

export async function getOrdersByShop(shopId: string): Promise<Order[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("shop_id", shopId)
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOrder);
}

export async function createOrder(
  shopId: string,
  input: OrderInput & { autoParsed?: ParsedOrderSms }
): Promise<Order> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const id = uuidv4();

  const { error } = await supabase.from("orders").insert({
    id,
    ...toDbRow(input, shopId, now),
    created_at: now,
  });
  if (error) throw error;

  if (input.autoParsed && input.rawSmsText?.trim()) {
    await saveSmsParseSample({
      shopId,
      orderId: id,
      rawSmsText: input.rawSmsText,
      autoParsed: input.autoParsed,
      sellerFinal: input,
    });
  }

  const { data, error: fetchError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  return rowToOrder(data);
}

export async function updateOrder(
  shopId: string,
  id: string,
  input: OrderInput
): Promise<Order | null> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update(toDbRow(input, shopId, now))
    .eq("id", id)
    .eq("shop_id", shopId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? rowToOrder(data) : null;
}

export async function getOrdersByIds(
  shopId: string,
  ids: string[]
): Promise<Order[]> {
  if (!ids.length) return [];
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("shop_id", shopId)
    .in("id", ids)
    .order("order_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToOrder);
}

export async function markOrdersExported(
  shopId: string,
  ids: string[]
): Promise<void> {
  if (!ids.length) return;
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({ status: "exported", updated_at: now })
    .eq("shop_id", shopId)
    .in("id", ids);
  if (error) throw error;
}

export async function patchOrderStatus(
  shopId: string,
  id: string,
  status: Order["status"]
): Promise<Order | null> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: now })
    .eq("id", id)
    .eq("shop_id", shopId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? rowToOrder(data) : null;
}

export async function deleteOrder(
  shopId: string,
  id: string
): Promise<boolean> {
  const supabase = createServerClient();
  const { error, count } = await supabase
    .from("orders")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("shop_id", shopId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** 수동 수정 시 가격 재계산 */
export function recalcOrderPricing(
  draft: OrderDraftPreview,
  products: SellerProductView[]
): OrderDraftPreview {
  const product = draft.productId
    ? products.find((p) => p.id === draft.productId)
    : null;
  const pricing = calcOrderPricing(
    product,
    draft.quantity,
    draft.postalCode,
    draft.address,
    draft.isRemoteArea
  );
  return {
    ...draft,
    purchasePrice: pricing.purchasePrice,
    shippingFee: pricing.shippingFee,
    supplyTotal: pricing.supplyTotal,
    celticDepositAmount: pricing.celticDepositAmount,
    isRemoteArea: pricing.isRemoteArea,
    productMatch: {
      productId: product?.id ?? null,
      officialName: product?.officialName ?? null,
      matchedBy: product ? draft.productMatch.matchedBy : "none",
      consumerPrice: product?.consumerPrice ?? 0,
    },
  };
}
