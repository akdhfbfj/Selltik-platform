import { parseCsvLine, parseCsvRecords, parsePrice } from "./csv-utils";
import { computeProductProfit } from "./product-profit";

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

function isMetaRow(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (n.includes("상 품 명") || n.includes("상품명")) return true;
  if (n.includes("본 가격표의 모든 단가")) return true;
  if (n.startsWith("예시)") || n.startsWith("※")) return true;
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
    const purchasePrice = parsePrice(cols[2] ?? "");
    const baseShipping = parsePrice(cols[3] ?? "");
    const supplyTotal =
      parsePrice(cols[4] ?? "") || purchasePrice + baseShipping;
    const consumerPrice = parsePrice(cols[5] ?? "");
    const { profitAmount, profitRate } = computeProductProfit(
      consumerPrice,
      supplyTotal
    );
    products.push({
      officialName,
      description: cols[1]?.trim() ?? "",
      purchasePrice,
      baseShipping,
      supplyTotal,
      consumerPrice,
      profitAmount,
      profitRate,
      sortOrder: order,
    });
  }

  return products;
}

export function formatKrw(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}
