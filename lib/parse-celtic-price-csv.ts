import { parseCsvLine, parseCsvRecords, parsePrice } from "./csv-utils";
import { computeProductProfit } from "./product-profit";

export interface ParsedCelticPriceProduct {
  officialName: string;
  celticPurchasePrice: number;
  celticBaseShipping: number;
  celticSupplyTotal: number;
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
  if (n === "셀틱" || n === "셀러" || n === "틱톡") return true;
  return false;
}

function isProductRow(name: string, cols: string[]): boolean {
  if (isMetaRow(name)) return false;
  return (
    parsePrice(cols[1] ?? "") > 0 ||
    parsePrice(cols[4] ?? "") > 0 ||
    parsePrice(cols[7] ?? "") > 0
  );
}

export function parseCelticPriceCsv(text: string): ParsedCelticPriceProduct[] {
  const products: ParsedCelticPriceProduct[] = [];
  let order = 0;

  for (const line of parseCsvRecords(text)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const officialName = (cols[0]?.trim() ?? "").replace(/\r/g, "");
    if (!isProductRow(officialName, cols)) continue;

    order += 1;
    const celticPurchase = parsePrice(cols[1] ?? "");
    const celticShipping = parsePrice(cols[2] ?? "");
    const celticTotal =
      parsePrice(cols[3] ?? "") || celticPurchase + celticShipping;
    const purchasePrice = parsePrice(cols[4] ?? "");
    const baseShipping = parsePrice(cols[5] ?? "");
    const supplyTotal =
      parsePrice(cols[6] ?? "") || purchasePrice + baseShipping;
    const consumerPrice = parsePrice(cols[7] ?? "");
    const { profitAmount, profitRate } = computeProductProfit(
      consumerPrice,
      supplyTotal
    );

    products.push({
      officialName,
      celticPurchasePrice: celticPurchase,
      celticBaseShipping: celticShipping,
      celticSupplyTotal: celticTotal,
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
