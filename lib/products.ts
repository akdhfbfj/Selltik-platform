import { v4 as uuidv4 } from "uuid";
import type {
  MasterProduct,
  SellerProductView,
} from "./types";
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

export async function getAllMasterProducts(): Promise<MasterProduct[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("master_products")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToProduct);
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

export async function importSupplyProducts(
  items: ParsedSupplyProduct[]
): Promise<{ imported: number; total: number }> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  let imported = 0;

  for (const item of items) {
    const existing = await getMasterProductByOfficialName(item.officialName);
    const row = {
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

    if (existing) {
      const { error } = await supabase
        .from("master_products")
        .update(row)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("master_products").insert({
        id: uuidv4(),
        ...row,
        created_at: now,
      });
      if (error) throw error;
    }
    imported += 1;
  }

  return { imported, total: items.length };
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
