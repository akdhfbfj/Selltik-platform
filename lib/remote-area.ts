const REMOTE_KEYWORDS = [
  "제주",
  "울릉",
  "독도",
  "거문도",
  "백령",
  "대청",
  "소청",
  "연평",
  "흑산",
  "추자",
  "가거도",
  "마라도",
  "우도",
];

/** 제주·도서산간 추가 배송비 */
export const REMOTE_SHIPPING_SURCHARGE = 4000;

export function isRemoteArea(postalCode: string, address: string): boolean {
  const pc = postalCode.trim();
  if (pc.startsWith("63")) return true;

  const normalized = address.replace(/\s/g, "");
  return REMOTE_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function calcShippingFee(
  baseShipping: number,
  postalCode: string,
  address: string
): { shippingFee: number; isRemoteArea: boolean } {
  const remote = isRemoteArea(postalCode, address);
  const shippingFee = baseShipping + (remote ? REMOTE_SHIPPING_SURCHARGE : 0);
  return { shippingFee, isRemoteArea: remote };
}
