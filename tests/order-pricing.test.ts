import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calcOrderPricing } from "../lib/order-pricing";

describe("calcOrderPricing", () => {
  const product = {
    purchasePrice: 98_000,
    baseShipping: 4_000,
    supplyTotal: 102_000,
    consumerPrice: 130_000,
  };

  it("계(E열) 단가 × 수량으로 셀틱 입금액 계산", () => {
    const r = calcOrderPricing(product, 2, "", "", false);
    assert.equal(r.celticDepositAmount, 204_000);
    assert.equal(r.customerDepositAmount, 260_000);
    assert.equal(r.marginAmount, 56_000);
  });

  it("도서산간 추가는 품목당 1회 · 고객·셀틱 동액 통과로 마진 유지", () => {
    const r = calcOrderPricing(product, 2, "", "제주 제주시", true);
    assert.equal(r.remoteSurcharge, 4_000);
    assert.equal(r.celticDepositAmount, 208_000); // 204_000 + 4_000
    assert.equal(r.customerDepositAmount, 264_000); // 260_000 + 4_000
    assert.equal(r.marginAmount, 56_000); // 일반과 동일
  });
});
