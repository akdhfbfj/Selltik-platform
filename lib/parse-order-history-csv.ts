import { parseCsvLine, parseCsvRecords, parsePrice } from "./csv-utils";

export interface ParsedOrderHistoryLine {
  orderDate: string;
  batchTitle: string;
  sellerName: string;
  productName: string;
  quantity: number;
  supplyPerUnit: number;
  depositAmount: number | null;
}

const COL = {
  orderDate: 0,
  batchTitle: 1,
  sellerName: 2,
  productName: 3,
  quantity: 4,
  supplyPerUnit: 14,
  deposit: 15,
} as const;

/** 파일(발주서)명에 '클' → 클레임 */
export function isClaimBatch(batchTitle: string): boolean {
  return batchTitle.includes("클");
}

/** 파일명에서 날짜 토큰 추출 (4/24B → 4/24, 4/25클 → 4/25, 24.6.25.A → 24.6.25) */
export function normalizeBatchTitleDateToken(batchTitle: string): string {
  let s = batchTitle.trim();
  s = s.replace(/클/gi, "");
  s = s.replace(/^(\d{1,2}\/\d{1,2})[A-Za-z]$/, "$1");
  s = s.replace(/^(\d{2}\.\d{1,2}\.\d{1,2})\.[A-Za-z]$/, "$1");
  return s.trim();
}

function extractYearFromBatchTitle(title: string): number | null {
  const m = title.match(/(?:^|[^\d])(\d{2})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  const year = 2000 + parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return year;
}

/** M/D, yy.m.d, yyyy-mm-dd 등 → yyyy-mm-dd */
export function parseOrderHistoryDate(
  raw: string,
  defaultYear: number,
  batchTitle = ""
): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const dotted = s.match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})$/);
  if (dotted) {
    const year = 2000 + parseInt(dotted[1], 10);
    return `${year}-${dotted[2].padStart(2, "0")}-${dotted[3].padStart(2, "0")}`;
  }

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    let year = defaultYear;
    if (slash[3]) {
      const y = parseInt(slash[3], 10);
      year = y < 100 ? 2000 + y : y;
    } else {
      const fromTitle = extractYearFromBatchTitle(batchTitle);
      if (fromTitle) year = fromTitle;
    }
    return `${year}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }

  return null;
}

export function resolveOrderHistoryDate(
  dateRaw: string,
  batchTitle: string,
  defaultYear: number
): string | null {
  const fromDateCol = parseOrderHistoryDate(dateRaw, defaultYear, batchTitle);
  if (fromDateCol) return fromDateCol;

  const batchToken = normalizeBatchTitleDateToken(batchTitle);
  if (batchToken && batchToken !== dateRaw) {
    return parseOrderHistoryDate(batchToken, defaultYear, batchTitle);
  }

  return null;
}

function isHeaderRow(cols: string[]): boolean {
  const first = cols[0]?.trim() ?? "";
  return first === "발주일" || first.includes("발주일");
}

export function parseOrderHistoryCsv(
  text: string,
  defaultYear = 2026
): { lines: ParsedOrderHistoryLine[]; claimsSkipped: number } {
  const lines: ParsedOrderHistoryLine[] = [];
  let ffDateRaw = "";
  let ffBatch = "";
  let ffSeller = "";
  let claimsSkipped = 0;

  for (const record of parseCsvRecords(text)) {
    if (!record.trim()) continue;
    const cols = parseCsvLine(record);
    if (isHeaderRow(cols)) continue;

    if (cols[COL.orderDate]?.trim()) {
      ffDateRaw = cols[COL.orderDate].trim();
    } else if (cols[COL.batchTitle]?.trim()) {
      const batchToken = normalizeBatchTitleDateToken(cols[COL.batchTitle].trim());
      if (resolveOrderHistoryDate(batchToken, cols[COL.batchTitle].trim(), defaultYear)) {
        ffDateRaw = batchToken;
      }
    }

    if (cols[COL.batchTitle]?.trim()) ffBatch = cols[COL.batchTitle].trim();
    if (cols[COL.sellerName]?.trim()) ffSeller = cols[COL.sellerName].trim();

    if (isClaimBatch(ffBatch)) {
      claimsSkipped += 1;
      continue;
    }

    const productName = (cols[COL.productName]?.trim() ?? "").replace(/\r/g, "");
    if (!productName) continue;

    const orderDate =
      resolveOrderHistoryDate(ffDateRaw, ffBatch, defaultYear) ?? "";
    if (!orderDate) continue;

    const quantity = Math.max(1, parseInt(cols[COL.quantity] ?? "1", 10) || 1);
    const supplyPerUnit = parsePrice(cols[COL.supplyPerUnit] ?? "");
    const depositRaw = cols[COL.deposit]?.trim() ?? "";
    const depositAmount = depositRaw ? parsePrice(depositRaw) : null;

    lines.push({
      orderDate,
      batchTitle: ffBatch,
      sellerName: ffSeller,
      productName,
      quantity,
      supplyPerUnit,
      depositAmount,
    });
  }

  return { lines, claimsSkipped };
}

export interface OrderHistoryBatchPreview {
  importKey: string;
  orderDate: string;
  batchTitle: string;
  sellerName: string;
  lineCount: number;
  celticDepositTotal: number;
  depositAmount: number | null;
}

export function groupOrderHistoryLines(
  lines: ParsedOrderHistoryLine[]
): OrderHistoryBatchPreview[] {
  const batches = new Map<string, OrderHistoryBatchPreview>();

  for (const line of lines) {
    if (!line.orderDate || isClaimBatch(line.batchTitle)) continue;

    const importKey = `${line.orderDate}|${line.batchTitle}|${line.sellerName}`;
    let batch = batches.get(importKey);
    if (!batch) {
      batch = {
        importKey,
        orderDate: line.orderDate,
        batchTitle: line.batchTitle,
        sellerName: line.sellerName,
        lineCount: 0,
        celticDepositTotal: 0,
        depositAmount: line.depositAmount,
      };
      batches.set(importKey, batch);
    }
    batch.lineCount += 1;
    batch.celticDepositTotal += line.supplyPerUnit * line.quantity;
    if (line.depositAmount != null && line.depositAmount > 0) {
      batch.depositAmount = line.depositAmount;
    }
  }

  return [...batches.values()].sort((a, b) =>
    a.orderDate.localeCompare(b.orderDate)
  );
}
