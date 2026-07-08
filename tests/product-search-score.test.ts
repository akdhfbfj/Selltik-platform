import test from "node:test";
import assert from "node:assert/strict";
import {
  rankProductsByHint,
  scoreProductRelevance,
} from "../lib/product-search-score";
import type { SellerProductView } from "../lib/types";

function mockProduct(
  partial: Partial<SellerProductView> & Pick<SellerProductView, "id" | "officialName">
): SellerProductView {
  return {
    id: partial.id,
    officialName: partial.officialName,
    smsName: partial.smsName ?? "",
    consumerPrice: partial.consumerPrice ?? 10000,
    purchasePrice: partial.purchasePrice ?? 8000,
    shippingFee: partial.shippingFee ?? 0,
    profitRate: partial.profitRate ?? "10",
    isFavorite: partial.isFavorite ?? false,
    isSoldOut: partial.isSoldOut ?? false,
    lastOutboundAt: partial.lastOutboundAt ?? null,
    sortOrder: partial.sortOrder ?? 0,
    pendingReview: partial.pendingReview ?? false,
  };
}

test("scoreProductRelevance: 롤팬블랙 토큰으로 블랙 variant 상위", () => {
  const black = mockProduct({
    id: "1",
    officialName: "롤팬 뉴 오리지널 (블랙+전용백)",
    smsName: "롤팬블랙",
  });
  const mint = mockProduct({
    id: "2",
    officialName: "롤팬 뉴 오리지널 (민트+전용백)",
    smsName: "롤팬민트",
  });

  assert.ok(
    scoreProductRelevance("롤팬블랙", black) >
      scoreProductRelevance("롤팬블랙", mint)
  );
});

test("rankProductsByHint: 분석어와 관련 있는 것만", () => {
  const products = [
    mockProduct({ id: "1", officialName: "롤팬 (블랙)", smsName: "롤팬" }),
    mockProduct({ id: "2", officialName: "세탁세제", smsName: "세제" }),
  ];
  const ranked = rankProductsByHint(products, "롤팬블랙");
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, "1");
});
