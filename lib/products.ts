import { v4 as uuidv4 } from "uuid";
import type { MasterProduct, MasterProductInput, SellerProductView } from "./types";
import type { ParsedSupplyProduct } from "./parse-supply-csv";
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
  const { error } = await supabase
    .from("master_products")
    .update(toDbRow(input, existing.sortOrder, now))
    .eq("id", id);
  if (error) throw error;
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
): Promise<{ imported: number; parsed: number; duplicates: number }> {
  const parsed = items.length;
  const uniqueItems = dedupeSupplyProducts(items);
  const duplicates = parsed - uniqueItems.length;

  const supabase = createServerClient();
  const now = new Date().toISOString();

  const existing = await fetchAllRows<{ id: string; official_name: string }>(
    (from, to) =>
      supabase
        .from("master_products")
        .select("id, official_name")
        .range(from, to)
        .then((r) => r)
  );

  const nameToId = new Map(existing.map((r) => [r.official_name, r.id]));

  const rows = uniqueItems.map((item) => {
    const existingId = nameToId.get(item.officialName);
    const base = {
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
    };
    if (existingId) {
      return { ...base, id: existingId };
    }
    return { ...base, id: uuidv4(), created_at: now };
  });

  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("master_products")
      .upsert(chunk, { onConflict: "official_name" });
    if (error) throw error;
  }

  return { imported: uniqueItems.length, parsed, duplicates };
}

export async function getSellerProductViews(
  shopId: string
): Promise<SellerProductView[]> {
  const products = await getAllMasterProducts();
  const supabase = createServerClient();
  const { data: aliases, error } = await supabase
    .from("seller_product_aliases")
    .select("*")
    .eq("shop_id", shopId);
  if (error) throw error;

  const aliasMap = new Map(
    (aliases ?? []).map((a) => [a.product_id as string, a.sms_name as string])
  );

  return products.map((p) => ({
    ...p,
    smsName: aliasMap.get(p.id) ?? "",
  }));
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
