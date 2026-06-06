export interface ParsedSupplyProduct {
  officialName: string;
  description: string;
  purchasePrice: number;
  baseShipping: number;
  supplyTotal: number;
  consumerPrice: number;
  profitAmount: number;
  profitRate: string;
  sortOrder: number;
}

function parsePrice(val: string): number {
  if (!val?.trim()) return 0;
  const n = parseInt(val.replace(/,/g, "").replace(/"/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** 따옴표 안 줄바꿈을 한 행으로 묶음 (RFC 4180) */
function parseCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (current.trim()) records.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) records.push(current);
  return records;
}

/** 간단 CSV 행 파싱 (따옴표 필드 지원) */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

function isMetaRow(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (n.includes("상 품 명") || n.includes("상품명")) return true;
  if (n.includes("본 가격표의 모든 단가")) return true;
  if (n === "설명" || n === "셀러") return true;
  return false;
}

function isProductRow(name: string, cols: string[]): boolean {
  const n = name.trim();
  if (isMetaRow(n)) return false;
  const hasPrice =
    parsePrice(cols[2] ?? "") > 0 || parsePrice(cols[5] ?? "") > 0;
  return hasPrice;
}

export function parseSupplyCsv(text: string): ParsedSupplyProduct[] {
  const products: ParsedSupplyProduct[] = [];
  let order = 0;

  for (const line of parseCsvRecords(text)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const officialName = (cols[0]?.trim() ?? "").replace(/\r/g, "");
    if (!isProductRow(officialName, cols)) continue;

    order += 1;
    products.push({
      officialName,
      description: cols[1]?.trim() ?? "",
      purchasePrice: parsePrice(cols[2] ?? ""),
      baseShipping: parsePrice(cols[3] ?? ""),
      supplyTotal: parsePrice(cols[4] ?? ""),
      consumerPrice: parsePrice(cols[5] ?? ""),
      profitAmount: parsePrice(cols[6] ?? ""),
      profitRate: (cols[7] ?? "").replace(/"/g, "").trim(),
      sortOrder: order,
    });
  }

  return products;
}

export function formatKrw(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}
