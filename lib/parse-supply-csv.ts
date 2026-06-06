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

function isProductRow(name: string, cols: string[]): boolean {
  const n = name.trim();
  if (!n) return false;
  if (n.includes("상 품 명") || n.includes("상품명")) return false;
  // 이 CSV는 상품명이 [브랜드] 로 시작함
  if (!n.startsWith("[")) return false;
  const hasPrice =
    parsePrice(cols[2] ?? "") > 0 || parsePrice(cols[5] ?? "") > 0;
  return hasPrice;
}

export function parseSupplyCsv(text: string): ParsedSupplyProduct[] {
  const lines = text.split(/\r?\n/);
  const products: ParsedSupplyProduct[] = [];
  let order = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const officialName = cols[0]?.trim() ?? "";
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
