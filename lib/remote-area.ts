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

export interface CalcShippingFeeOptions {
  /** 체크박스 등 수동 지정. 없으면 주소로 자동 판별 */
  isRemoteArea?: boolean;
  /** 도서·산간 추가 배송비를 곱할 품목 수 (동일 상품 여러 개도 품목 1건) */
  remoteLineCount?: number;
}

export function calcShippingFee(
  baseShipping: number,
  postalCode: string,
  address: string,
  options?: CalcShippingFeeOptions
): {
  shippingFee: number;
  isRemoteArea: boolean;
  remoteSurcharge: number;
} {
  const remote =
    options?.isRemoteArea !== undefined
      ? options.isRemoteArea
      : isRemoteArea(postalCode, address);
  const lineCount = Math.max(1, options?.remoteLineCount ?? 1);
  const remoteSurcharge = remote ? REMOTE_SHIPPING_SURCHARGE * lineCount : 0;
  const shippingFee = baseShipping + remoteSurcharge;
  return { shippingFee, isRemoteArea: remote, remoteSurcharge };
}
