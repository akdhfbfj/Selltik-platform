import { formatKrw } from "./parse-supply-csv";
import type { ProductReviewReason, SellerProductView } from "./types";

export const REVIEW_REASON_LABELS: Record<ProductReviewReason, string> = {
  new: "신규 등록",
  price_change: "공급가·판매가 변경",
  info_change: "상품 정보 변경",
  sold_out: "품절",
};

export function describeProductChanges(p: SellerProductView): string[] {
  if (p.reviewReason === "new") {
    return ["셀틱에 새로 등록된 상품입니다. 판매가를 확인해 주세요."];
  }

  if (p.reviewReason === "sold_out") {
    const prev = p.changeDetail?.previous?.isSoldOut;
    if (prev === false && p.isSoldOut) {
      return ["품절 처리되었습니다."];
    }
    if (prev === true && !p.isSoldOut) {
      return ["품절이 해제되었습니다."];
    }
    return p.isSoldOut
      ? ["품절 처리되었습니다."]
      : ["품절 상태가 변경되었습니다."];
  }

  const prev = p.changeDetail?.previous;
  if (!prev) {
    return [REVIEW_REASON_LABELS[p.reviewReason ?? "price_change"]];
  }

  const lines: string[] = [];

  if (prev.officialName && prev.officialName !== p.officialName) {
    lines.push(`상품명: ${prev.officialName} → ${p.officialName}`);
  }
  if (
    prev.consumerPrice !== undefined &&
    prev.consumerPrice !== p.consumerPrice
  ) {
    lines.push(
      `판매가: ${formatKrw(prev.consumerPrice)} → ${formatKrw(p.consumerPrice)}`
    );
  }
  if (prev.supplyTotal !== undefined && prev.supplyTotal !== p.supplyTotal) {
    lines.push(
      `공급가(계): ${formatKrw(prev.supplyTotal)} → ${formatKrw(p.supplyTotal)}`
    );
  } else {
    if (
      prev.purchasePrice !== undefined &&
      prev.purchasePrice !== p.purchasePrice
    ) {
      lines.push(
        `매입가: ${formatKrw(prev.purchasePrice)} → ${formatKrw(p.purchasePrice)}`
      );
    }
    if (
      prev.baseShipping !== undefined &&
      prev.baseShipping !== p.baseShipping
    ) {
      lines.push(
        `배송비: ${formatKrw(prev.baseShipping)} → ${formatKrw(p.baseShipping)}`
      );
    }
  }
  if (prev.description && prev.description !== p.description) {
    lines.push("상품 설명이 변경되었습니다.");
  }

  return lines.length > 0
    ? lines
    : [REVIEW_REASON_LABELS[p.reviewReason ?? "price_change"]];
}
