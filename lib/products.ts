import { v4 as uuidv4 } from "uuid";
import type { MasterProduct, MasterProductInput, SellerProductView } from "./types";
import type { ParsedSupplyProduct } from "./parse-supply-csv";
import { getAllShops } from "./shops";
import { createServerClient } from "./supabase/server";

type DbRow = Record<string, unknown>;

function rowToProduct(row: DbRow): MasterProduct {
  return {
    id: row.id as string,
    officialName: row.official_name as string,
    description: row.description as string,
    purchasePrice: row.purchase_price as number,
    baseShipping: row.base_shipping as number,
    supplyTotal: row.supply_total as number,
    consumerPrice: row.consumer_price as number,
    profitAmount: row.profit_amount as number,
    profitRate: row.profit_rate as string,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as string,
  };
}

function toDbRow(input: MasterProductInput, sortOrder: number, now: string) {
  const supplyTotal = input.purchasePrice + input.baseShipping;
  const profitAmount =
    input.profitAmount ?? Math.max(0, input.consumerPrice - supplyTotal);
  return {
    official_name: input.officialName.trim(),
    description: input.description?.trim() ?? "",
    purchase_price: input.purchasePrice,
    base_shipping: input.baseShipping,
    supply_total: supplyTotal,
    consumer_price: input.consumerPrice,
    profit_amount: profitAmount,
    profit_rate: input.profitRate?.trim() ?? "",
    sort_order: sortOrder,
    updated_at: now,
  };
}

export function formatDbError(error: { message?: string; code?: string }): string {
  const msg = error.message ?? "";
  if (msg.includes("master_products") && msg.includes("does not exist")) {
    return "DB 테이블이 없습니다. Supabase SQL Editor에서 003_master_products.sql을 실행하세요.";
  }
  if (msg.includes("seller_product_reviews") && msg.includes("does not exist")) {
    return "DB 테이블이 없습니다. Supabase SQL Editor에서 004_seller_product_reviews.sql을 실행하세요.";
  }
  if (error.code === "23505") {
    return "이미 같은 상품명이 있습니다.";
  }
  return msg || "DB 오류가 발생했습니다.";
}

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

export async function getAllMasterProducts(): Promise<MasterProduct[]> {
  const supabase = createServerClient();
  const rows = await fetchAllRows<DbRow>((from, to) =>
    supabase
      .from("master_products")
      .select("*")
      .order("sort_order", { ascending: true })
      .range(from, to)
      .then((r) => r)
  );
  return rows.map(rowToProduct);
}

export async function getMasterProductById(id: string): Promise<MasterProduct | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("master_products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProduct(data) : null;
}

export async function getMasterProductByOfficialName(
  officialName: string
): Promise<MasterProduct | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("master_products")
    .select("*")
    .eq("official_name", officialName)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProduct(data) : null;
}

function masterInputDiffers(
  existing: MasterProduct,
  input: MasterProductInput
): boolean {
  const supplyTotal = input.purchasePrice + input.baseShipping;
  const profitAmount =
    input.profitAmount ?? Math.max(0, input.consumerPrice - supplyTotal);
  return (
    existing.officialName !== input.officialName.trim() ||
    existing.description !== (input.description?.trim() ?? "") ||
    existing.purchasePrice !== input.purchasePrice ||
    existing.baseShipping !== input.baseShipping ||
    existing.supplyTotal !== supplyTotal ||
    existing.consumerPrice !== input.consumerPrice ||
    existing.profitAmount !== profitAmount ||
    existing.profitRate !== (input.profitRate?.trim() ?? "")
  );
}

function parsedItemDiffers(
  existing: MasterProduct,
  item: ParsedSupplyProduct
): boolean {
  return (
    existing.description !== item.description ||
    existing.purchasePrice !== item.purchasePrice ||
    existing.baseShipping !== item.baseShipping ||
    existing.supplyTotal !== item.supplyTotal ||
    existing.consumerPrice !== item.consumerPrice ||
    existing.profitAmount !== item.profitAmount ||
    existing.profitRate !== item.profitRate
  );
}

/** 변경·신규 상품 — 모든 셀러에게 확인 요청 (문자용 상품명은 그대로) */
export async function flagProductsForSellerReview(
  productIds: string[]
): Promise<void> {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return;

  const shops = await getAllShops();
  if (shops.length === 0) return;

  const supabase = createServerClient();
  const now = new Date().toISOString();
  const rows = shops.flatMap((shop) =>
    uniqueIds.map((productId) => ({
      id: uuidv4(),
      shop_id: shop.id,
      product_id: productId,
      needs_review: true,
      flagged_at: now,
      acknowledged_at: null,
    }))
  );

  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("seller_product_reviews")
      .upsert(chunk, { onConflict: "shop_id,product_id" });
    if (error) throw error;
  }
}

export async function acknowledgeProductReview(
  shopId: string,
  productId: string
): Promise<boolean> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("seller_product_reviews")
    .update({ needs_review: false, acknowledged_at: now })
    .eq("shop_id", shopId)
    .eq("product_id", productId)
    .eq("needs_review", true)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function createMasterProduct(
  input: MasterProductInput
): Promise<MasterProduct> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const products = await getAllMasterProducts();
  const sortOrder = products.length + 1;
  const id = uuidv4();

  const { error } = await supabase.from("master_products").insert({
    id,
    ...toDbRow(input, sortOrder, now),
    created_at: now,
  });
  if (error) throw error;
  await flagProductsForSellerReview([id]);
  return (await getMasterProductById(id))!;
}

export async function updateMasterProduct(
  id: string,
  input: MasterProductInput
): Promise<MasterProduct | null> {
  const existing = await getMasterProductById(id);
  if (!existing) return null;

  const supabase = createServerClient();
  const now = new Date().toISOString();
  const changed = masterInputDiffers(existing, input);
  const { error } = await supabase
    .from("master_products")
    .update(toDbRow(input, existing.sortOrder, now))
    .eq("id", id);
  if (error) throw error;
  if (changed) await flagProductsForSellerReview([id]);
  return getMasterProductById(id);
}

export async function deleteMasterProduct(id: string): Promise<boolean> {
  const supabase = createServerClient();
  const { error, count } = await supabase
    .from("master_products")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** 같은 상품명은 마지막 행 기준 (CSV 중복·배치 upsert 오류 방지) */
function dedupeSupplyProducts(items: ParsedSupplyProduct[]): ParsedSupplyProduct[] {
  const map = new Map<string, ParsedSupplyProduct>();
  for (const item of items) {
    map.set(item.officialName, item);
  }
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** CSV 일괄 반영 — 배치 upsert (Vercel 타임아웃 방지) */
export async function importSupplyProducts(
  items: ParsedSupplyProduct[]
): Promise<{
  imported: number;
  parsed: number;
  duplicates: number;
  changed: number;
}> {
  const parsed = items.length;
  const uniqueItems = dedupeSupplyProducts(items);
  const duplicates = parsed - uniqueItems.length;

  const supabase = createServerClient();
  const now = new Date().toISOString();

  const existingProducts = await getAllMasterProducts();
  const nameToProduct = new Map(
    existingProducts.map((p) => [p.officialName, p])
  );

  const existingMeta = await fetchAllRows<{
    id: string;
    official_name: string;
    created_at: string;
  }>((from, to) =>
    supabase
      .from("master_products")
      .select("id, official_name, created_at")
      .range(from, to)
      .then((r) => r)
  );
  const nameToMeta = new Map(existingMeta.map((r) => [r.official_name, r]));

  const finalChangedIds: string[] = [];
  const upsertRows = uniqueItems.map((item) => {
    const meta = nameToMeta.get(item.officialName);
    const existing = nameToProduct.get(item.officialName);
    const id = meta?.id ?? uuidv4();
    if (!existing || parsedItemDiffers(existing, item)) {
      finalChangedIds.push(id);
    }
    return {
      id,
      official_name: item.officialName,
      description: item.description,
      purchase_price: item.purchasePrice,
      base_shipping: item.baseShipping,
      supply_total: item.supplyTotal,
      consumer_price: item.consumerPrice,
      profit_amount: item.profitAmount,
      profit_rate: item.profitRate,
      sort_order: item.sortOrder,
      updated_at: now,
      created_at: meta?.created_at ?? now,
    };
  });

  const CHUNK = 50;
  for (let i = 0; i < upsertRows.length; i += CHUNK) {
    const chunk = upsertRows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("master_products")
      .upsert(chunk, { onConflict: "official_name" });
    if (error) throw error;
  }

  await flagProductsForSellerReview(finalChangedIds);

  return {
    imported: uniqueItems.length,
    parsed,
    duplicates,
    changed: finalChangedIds.length,
  };
}

export async function getSellerProductViews(
  shopId: string
): Promise<SellerProductView[]> {
  const products = await getAllMasterProducts();
  const supabase = createServerClient();
  const [{ data: aliases, error: aliasError }, { data: reviews, error: reviewError }] =
    await Promise.all([
      supabase.from("seller_product_aliases").select("*").eq("shop_id", shopId),
      supabase
        .from("seller_product_reviews")
        .select("product_id")
        .eq("shop_id", shopId)
        .eq("needs_review", true),
    ]);
  if (aliasError) throw aliasError;
  if (reviewError) throw reviewError;

  const aliasMap = new Map(
    (aliases ?? []).map((a) => [a.product_id as string, a.sms_name as string])
  );
  const reviewSet = new Set(
    (reviews ?? []).map((r) => r.product_id as string)
  );

  return products.map((p) => ({
    ...p,
    smsName: aliasMap.get(p.id) ?? "",
    needsReview: reviewSet.has(p.id),
  }));
}

export async function countPendingProductReviews(shopId: string): Promise<number> {
  const supabase = createServerClient();
  const { count, error } = await supabase
    .from("seller_product_reviews")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("needs_review", true);
  if (error) throw error;
  return count ?? 0;
}

export async function upsertSellerAliases(
  shopId: string,
  aliases: { productId: string; smsName: string }[]
) {
  const supabase = createServerClient();
  const now = new Date().toISOString();

  for (const { productId, smsName } of aliases) {
    const { data: existing } = await supabase
      .from("seller_product_aliases")
      .select("id")
      .eq("shop_id", shopId)
      .eq("product_id", productId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("seller_product_aliases")
        .update({ sms_name: smsName.trim(), updated_at: now })
        .eq("id", existing.id);
      if (error) throw error;
    } else if (smsName.trim()) {
      const { error } = await supabase.from("seller_product_aliases").insert({
        id: uuidv4(),
        shop_id: shopId,
        product_id: productId,
        sms_name: smsName.trim(),
        created_at: now,
        updated_at: now,
      });
      if (error) throw error;
    }
  }
}
