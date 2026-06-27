export const SELLER_INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

/** CSV 설명란에서 「■구성 : …」 추출, 없으면 첫 줄 */
export function extractProductComposition(description: string): string {
  const text = description.trim();
  if (!text) return "";
  const match = text.match(/[■\s]*구성\s*[：:]\s*(.+)/i);
  if (match) return match[1].trim().split(/\r?\n/)[0]?.trim() ?? "";
  return text.split(/\r?\n/)[0]?.trim() ?? text;
}

/** 마진율 문자열 → 숫자 (예: "23%" → 23) */
export function parseProfitRate(rate: string): number {
  if (!rate.trim()) return 0;
  const n = parseFloat(rate.replace(/[%％,\s]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}
