import type { ContactInput, Recommendation } from "./types";

export function buildContactPrefillFromRecommendation(
  rec: Recommendation
): Partial<ContactInput> {
  const notes = [
    rec.brand ? `브랜드: ${rec.brand}` : "",
    `상품: ${rec.productName}`,
    rec.desiredPrice ? `희망 판매가격: ${rec.desiredPrice}` : "",
    rec.referenceUrl ? `참고 URL: ${rec.referenceUrl}` : "",
    `추천 쇼핑몰: ${rec.sellerName}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    companyName: "",
    notes,
    recommendationId: rec.id,
  };
}
