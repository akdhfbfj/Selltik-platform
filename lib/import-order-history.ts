import { v4 as uuidv4 } from "uuid";
import type { ParsedOrderHistoryLine } from "./parse-order-history-csv";
import { groupOrderHistoryLines, isClaimBatch } from "./parse-order-history-csv";
import {
  matchMasterProductByName,
  normalizeSellerName,
} from "./product-name-match";
import { getAllMasterProducts } from "./products";
import { getAllShops } from "./shops";
import { createServerClient } from "./supabase/server";
import type { ImportedOrderBatch } from "./types";

type DbRow = Record<string, unknown>;

function rowToBatch(row: DbRow): ImportedOrderBatch {
  return {
    id: row.id as string,
    shopId: (row.shop_id as string | null) ?? null,
    sellerName: row.seller_name as string,
    orderDate: row.order_date as string,
    batchTitle: row.batch_title as string,
    lineCount: row.line_count as number,
    unmatchedLines: row.unmatched_lines as number,
    celticDepositTotal: row.celtic_deposit_total as number,
    depositAmount: (row.deposit_amount as number | null) ?? null,
    sellerSalesTotal: row.seller_sales_total as number,
    sellerMarginTotal: row.seller_margin_total as number,
    celticCostTotal: row.celtic_cost_total as number,
    celticMarginTotal: row.celtic_margin_total as number,
    importKey: row.import_key as string,
    sourceFileName: row.source_file_name as string,
    isConfirmed: (row.is_confirmed as boolean | undefined) ?? false,
    createdAt: row.created_at as string,
  };
}

async function fetchAllBatchRows(options?: {
  fromDate?: string;
  toDate?: string;
  seller?: string;
  confirmed?: boolean;
}): Promise<DbRow[]> {
  const supabase = createServerClient();
  const PAGE_SIZE = 1000;
  const allRows: DbRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("imported_order_batches")
      .select("*")
      .order("order_date", { ascending: true })
      .order("batch_title", { ascending: true })
      .order("seller_name", { ascending: true })
      .order("created_at", { ascending: true });

    if (options?.fromDate) query = query.gte("order_date", options.fromDate);
    if (options?.toDate) query = query.lte("order_date", options.toDate);
    if (options?.seller) {
      query = query.ilike("seller_name", `%${options.seller.trim()}%`);
    }
    if (options?.confirmed !== undefined) {
      query = query.eq("is_confirmed", options.confirmed);
    }

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    allRows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

function sumBatchTotals(batches: ImportedOrderBatch[]) {
  return batches.reduce(
    (acc, b) => {
      acc.batchCount += 1;
      acc.lineCount += b.lineCount;
      acc.celticDepositTotal += b.celticDepositTotal;
      acc.depositAmountTotal += b.depositAmount ?? 0;
      acc.sellerSalesTotal += b.sellerSalesTotal;
      acc.sellerMarginTotal += b.sellerMarginTotal;
      acc.celticCostTotal += b.celticCostTotal;
      acc.celticMarginTotal += b.celticMarginTotal;
      acc.unmatchedLines += b.unmatchedLines;
      return acc;
    },
    {
      batchCount: 0,
      lineCount: 0,
      celticDepositTotal: 0,
      depositAmountTotal: 0,
      sellerSalesTotal: 0,
      sellerMarginTotal: 0,
      celticCostTotal: 0,
      celticMarginTotal: 0,
      unmatchedLines: 0,
    }
  );
}

function resolveShopId(
  sellerName: string,
  shopNameToId: Map<string, string>
): string | null {
  if (!sellerName.trim()) return null;
  return shopNameToId.get(normalizeSellerName(sellerName)) ?? null;
}

export async function importOrderHistoryCsv(
  lines: ParsedOrderHistoryLine[],
  sourceFileName: string
): Promise<{
  imported: number;
  skipped: number;
  parsedLines: number;
  batchCount: number;
  unmatchedLines: number;
}> {
  const parsedLines = lines.length;
  const previews = groupOrderHistoryLines(lines).filter(
    (p) => p.orderDate && !isClaimBatch(p.batchTitle)
  );
  const [products, shops] = await Promise.all([
    getAllMasterProducts(),
    getAllShops(),
  ]);

  const shopNameToId = new Map(
    shops.map((s) => [normalizeSellerName(s.name), s.id])
  );

  const now = new Date().toISOString();
  const supabase = createServerClient();

  const lineIndex = new Map<string, ParsedOrderHistoryLine[]>();
  for (const line of lines) {
    const key = `${line.orderDate}|${line.batchTitle}|${line.sellerName}`;
    const arr = lineIndex.get(key) ?? [];
    arr.push(line);
    lineIndex.set(key, arr);
  }

  let unmatchedLines = 0;
  const rows = previews.map((preview) => {
    const batchLines = lineIndex.get(preview.importKey) ?? [];
    let sellerSalesTotal = 0;
    let sellerMarginTotal = 0;
    let celticCostTotal = 0;
    let celticMarginTotal = 0;
    let batchUnmatched = 0;

    for (const line of batchLines) {
      const product = matchMasterProductByName(line.productName, products);
      if (!product) {
        batchUnmatched += 1;
        unmatchedLines += 1;
        continue;
      }
      const qty = line.quantity;
      // H×qty, (H−G)×qty, D×qty, (G−D)×qty — 매입가관리 CSV 기준 줄별 합산
      sellerSalesTotal += product.consumerPrice * qty;
      sellerMarginTotal += (product.consumerPrice - product.supplyTotal) * qty;
      if (product.celticSupplyTotal > 0) {
        celticCostTotal += product.celticSupplyTotal * qty;
        celticMarginTotal +=
          (product.supplyTotal - product.celticSupplyTotal) * qty;
      }
    }

    const celticDepositTotal = preview.celticDepositTotal;

    return {
      id: uuidv4(),
      shop_id: resolveShopId(preview.sellerName, shopNameToId),
      seller_name: preview.sellerName,
      order_date: preview.orderDate,
      batch_title: preview.batchTitle,
      line_count: preview.lineCount,
      unmatched_lines: batchUnmatched,
      celtic_deposit_total: celticDepositTotal,
      deposit_amount: preview.depositAmount,
      seller_sales_total: sellerSalesTotal,
      seller_margin_total: sellerMarginTotal,
      celtic_cost_total: celticCostTotal,
      celtic_margin_total: celticMarginTotal,
      import_key: preview.importKey,
      source_file_name: sourceFileName,
      is_confirmed: false,
      created_at: now,
    };
  });

  const importKeys = rows.map((r) => r.import_key);
  const { data: existing } = await supabase
    .from("imported_order_batches")
    .select("import_key")
    .in("import_key", importKeys);

  const existingKeys = new Set((existing ?? []).map((r) => r.import_key as string));
  const toInsert = rows.filter((r) => !existingKeys.has(r.import_key));
  const skipped = rows.length - toInsert.length;

  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from("imported_order_batches").insert(chunk);
    if (error) throw error;
  }

  return {
    imported: toInsert.length,
    skipped,
    parsedLines,
    batchCount: previews.length,
    unmatchedLines,
  };
}

export async function getImportedOrderBatchStats(options?: {
  fromDate?: string;
  toDate?: string;
  seller?: string;
}): Promise<{
  batchCount: number;
  lineCount: number;
  celticDepositTotal: number;
  depositAmountTotal: number;
  sellerSalesTotal: number;
  sellerMarginTotal: number;
  celticCostTotal: number;
  celticMarginTotal: number;
  unmatchedLines: number;
  batches: ImportedOrderBatch[];
  filteredFrom: string | null;
  filteredTo: string | null;
  filteredSeller: string | null;
  claimBatchCount: number;
  invalidDateBatchCount: number;
}> {
  const supabase = createServerClient();
  const filterOpts = {
    fromDate: options?.fromDate,
    toDate: options?.toDate,
    seller: options?.seller,
  };

  const allRows = await fetchAllBatchRows(filterOpts);
  const batches = allRows.map(rowToBatch);
  const totals = sumBatchTotals(batches);

  const [claimRes, invalidRes] = await Promise.all([
    supabase
      .from("imported_order_batches")
      .select("*", { count: "exact", head: true })
      .like("batch_title", "%클%"),
    supabase
      .from("imported_order_batches")
      .select("*", { count: "exact", head: true })
      .eq("order_date", "1970-01-01"),
  ]);
  if (claimRes.error) throw claimRes.error;
  if (invalidRes.error) throw invalidRes.error;

  return {
    ...totals,
    batches,
    filteredFrom: options?.fromDate ?? null,
    filteredTo: options?.toDate ?? null,
    filteredSeller: options?.seller?.trim() || null,
    claimBatchCount: claimRes.count ?? 0,
    invalidDateBatchCount: invalidRes.count ?? 0,
  };
}

export async function confirmImportedOrderBatch(id: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("imported_order_batches")
    .update({ is_confirmed: true })
    .eq("id", id)
    .eq("is_confirmed", false)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function deleteClaimImportedOrderBatches(): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("imported_order_batches")
    .delete()
    .like("batch_title", "%클%")
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

export async function deleteInvalidDateImportedOrderBatches(): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("imported_order_batches")
    .delete()
    .eq("order_date", "1970-01-01")
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

export async function deleteImportedOrderBatch(id: string): Promise<boolean> {
  const supabase = createServerClient();
  const { error, count } = await supabase
    .from("imported_order_batches")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function clearImportedOrderBatches(): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("imported_order_batches")
    .delete()
    .neq("id", "")
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}
