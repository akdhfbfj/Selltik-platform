import { v4 as uuidv4 } from "uuid";
import type {
  MasterProduct,
  MasterProductInput,
  ProductChangeDetail,
  ProductReviewReason,
  SellerProductView,
} from "./types";
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
  if (msg.includes("seller_product_favorites") && msg.includes("does not exist")) {
    return "DB 테이블이 없습니다. Supabase SQL Editor에서 011_seller_product_favorites.sql을 실행하세요.";
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

export interface ProductReviewFlag {
  productId: string;
  reason: ProductReviewReason;
  changeDetail?: ProductChangeDetail;
}

function buildChangeDetailFromProduct(
  product: MasterProduct
): ProductChangeDetail {
  return {
    previous: {
      officialName: product.officialName,
      description: product.description,
      purchasePrice: product.purchasePrice,
      baseShipping: product.baseShipping,
      supplyTotal: product.supplyTotal,
      consumerPrice: product.consumerPrice,
    },
  };
}

export function classifyProductReviewReason(
  existing: MasterProduct | null | undefined,
  next: {
    purchasePrice: number;
    baseShipping: number;
    consumerPrice: number;
    officialName?: string;
    description?: string;
  }
): ProductReviewReason {
  if (!existing) return "new";
  const priceChanged =
    existing.purchasePrice !== next.purchasePrice ||
    existing.baseShipping !== next.baseShipping ||
    existing.consumerPrice !== next.consumerPrice ||
    existing.supplyTotal !== next.purchasePrice + next.baseShipping;
  if (priceChanged) return "price_change";
  return "info_change";
}

/** 변경·신규 상품 — 모든 셀러에게 확인 요청 (문자용 상품명은 그대로) */
export async function flagProductsForSellerReview(
  flags: ProductReviewFlag[]
): Promise<void> {
  const byId = new Map<string, ProductReviewFlag>();
  for (const flag of flags) {
    byId.set(flag.productId, flag);
  }
  if (byId.size === 0) return;

  const shops = await getAllShops();
  if (shops.length === 0) return;

  const supabase = createServerClient();
  const now = new Date().toISOString();
  const rows = shops.flatMap((shop) =>
    [...byId.values()].map((flag) => ({
      id: uuidv4(),
      shop_id: shop.id,
      product_id: flag.productId,
      needs_review: true,
      flagged_at: now,
      acknowledged_at: null,
      review_reason: flag.reason,
      change_detail: flag.changeDetail ?? null,
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
  const count = await acknowledgeProductReviews(shopId, [productId]);
  return count > 0;
}

export async function acknowledgeProductReviews(
  shopId: string,
  productIds?: string[]
): Promise<number> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  let query = supabase
    .from("seller_product_reviews")
    .update({ needs_review: false, acknowledged_at: now })
    .eq("shop_id", shopId)
    .eq("needs_review", true);

  if (productIds?.length) {
    query = query.in("product_id", productIds);
  }

  const { data, error } = await query.select("id");
  if (error) throw error;
  return data?.length ?? 0;
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
  await flagProductsForSellerReview([
    { productId: id, reason: "new" },
  ]);
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
  if (changed) {
    await flagProductsForSellerReview([
      {
        productId: id,
        reason: classifyProductReviewReason(existing, input),
        changeDetail: buildChangeDetailFromProduct(existing),
      },
    ]);
  }
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

/** 공급가표 전체 초기화 — 재업로드 전 일괄 삭제용 */
export async function deleteAllMasterProducts(): Promise<number> {
  const supabase = createServerClient();
  const { error, count } = await supabase
    .from("master_products")
    .delete({ count: "exact" })
    .neq("id", "");
  if (error) throw error;
  return count ?? 0;
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

  const reviewFlags: ProductReviewFlag[] = [];
  const upsertRows = uniqueItems.map((item) => {
    const meta = nameToMeta.get(item.officialName);
    const existing = nameToProduct.get(item.officialName);
    const id = meta?.id ?? uuidv4();
    if (!existing || parsedItemDiffers(existing, item)) {
      reviewFlags.push({
        productId: id,
        reason: classifyProductReviewReason(existing, item),
        changeDetail: existing
          ? buildChangeDetailFromProduct(existing)
          : undefined,
      });
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

  await flagProductsForSellerReview(reviewFlags);

  return {
    imported: uniqueItems.length,
    parsed,
    duplicates,
    changed: reviewFlags.length,
  };
}

export async function getSellerProductViews(
  shopId: string
): Promise<SellerProductView[]> {
  const products = await getAllMasterProducts();
  const supabase = createServerClient();
  const [
    { data: aliases, error: aliasError },
    { data: reviews, error: reviewError },
    { data: favorites, error: favoriteError },
  ] = await Promise.all([
    supabase.from("seller_product_aliases").select("*").eq("shop_id", shopId),
    supabase
      .from("seller_product_reviews")
      .select("product_id, review_reason, change_detail")
      .eq("shop_id", shopId)
      .eq("needs_review", true),
    supabase
      .from("seller_product_favorites")
      .select("product_id")
      .eq("shop_id", shopId),
  ]);
  if (aliasError) throw aliasError;
  if (reviewError) throw reviewError;

  const favoriteSet = new Set<string>();
  if (favoriteError) {
    const msg = favoriteError.message ?? "";
    if (!msg.includes("seller_product_favorites") || !msg.includes("does not exist")) {
      throw favoriteError;
    }
  } else {
    for (const f of favorites ?? []) {
      favoriteSet.add(f.product_id as string);
    }
  }

  const aliasMap = new Map(
    (aliases ?? []).map((a) => [a.product_id as string, a.sms_name as string])
  );
  const reviewMap = new Map(
    (reviews ?? []).map((r) => [
      r.product_id as string,
      {
        reason: (r.review_reason as ProductReviewReason) ?? "price_change",
        detail: (r.change_detail as ProductChangeDetail | null) ?? undefined,
      },
    ])
  );

  return products.map((p) => {
    const review = reviewMap.get(p.id);
    return {
      ...p,
      smsName: aliasMap.get(p.id) ?? "",
      isFavorite: favoriteSet.has(p.id),
      needsReview: !!review,
      reviewReason: review?.reason,
      changeDetail: review?.detail,
    };
  });
}

export async function setSellerProductFavorite(
  shopId: string,
  productId: string,
  favorite: boolean
): Promise<void> {
  const supabase = createServerClient();

  if (favorite) {
    const { data: existing, error: fetchError } = await supabase
      .from("seller_product_favorites")
      .select("id")
      .eq("shop_id", shopId)
      .eq("product_id", productId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (existing) return;

    const { error } = await supabase.from("seller_product_favorites").insert({
      id: uuidv4(),
      shop_id: shopId,
      product_id: productId,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("seller_product_favorites")
    .delete()
    .eq("shop_id", shopId)
    .eq("product_id", productId);
  if (error) throw error;
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
  if (!aliases.length) return;

  const supabase = createServerClient();
  const now = new Date().toISOString();
  const productIds = aliases.map((a) => a.productId);

  const { data: existingRows, error: fetchError } = await supabase
    .from("seller_product_aliases")
    .select("id, product_id, sms_name")
    .eq("shop_id", shopId)
    .in("product_id", productIds);
  if (fetchError) throw fetchError;

  const existingByProduct = new Map(
    (existingRows ?? []).map((row) => [row.product_id as string, row])
  );

  const inserts: Record<string, unknown>[] = [];
  const updateTasks: Array<() => Promise<void>> = [];

  for (const { productId, smsName } of aliases) {
    const trimmed = smsName.trim();
    const existing = existingByProduct.get(productId);

    if (existing) {
      if ((existing.sms_name as string) === trimmed) continue;
      const rowId = existing.id as string;
      updateTasks.push(async () => {
        const { error } = await supabase
          .from("seller_product_aliases")
          .update({ sms_name: trimmed, updated_at: now })
          .eq("id", rowId);
        if (error) throw error;
      });
    } else if (trimmed) {
      inserts.push({
        id: uuidv4(),
        shop_id: shopId,
        product_id: productId,
        sms_name: trimmed,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await Promise.all(updateTasks.map((task) => task()));
  if (inserts.length) {
    const { error } = await supabase
      .from("seller_product_aliases")
      .insert(inserts);
    if (error) throw error;
  }
}
