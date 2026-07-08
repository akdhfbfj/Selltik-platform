import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeProductProfit } from "../lib/product-profit";

describe("computeProductProfit", () => {
  it("판매가 − 공급가(계)로 마진·마진율 계산", () => {
    const r = computeProductProfit(98_000, 84_000);
    assert.equal(r.profitAmount, 14_000);
    assert.equal(r.profitRate, "14.3%");
  });

  it("판매가가 0이면 마진율 빈 문자열", () => {
    const r = computeProductProfit(0, 0);
    assert.equal(r.profitAmount, 0);
    assert.equal(r.profitRate, "");
  });

  it("공급가가 판매가보다 크면 마진 0", () => {
    const r = computeProductProfit(10_000, 12_000);
    assert.equal(r.profitAmount, 0);
    assert.equal(r.profitRate, "0.0%");
  });
});
