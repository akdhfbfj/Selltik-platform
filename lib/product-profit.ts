/** 판매가·공급가(계)로 마진·마진율 계산 */
export function computeProductProfit(
  consumerPrice: number,
  supplyTotal: number
): { profitAmount: number; profitRate: string } {
  const profitAmount = Math.max(0, consumerPrice - supplyTotal);
  const profitRate =
    consumerPrice > 0
      ? `${((profitAmount / consumerPrice) * 100).toFixed(1)}%`
      : "";
  return { profitAmount, profitRate };
}
