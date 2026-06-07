import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesOrderSearch } from "../lib/order-search";
import type { Order } from "../lib/types";

const sample = (overrides: Partial<Order> = {}): Order => ({
  id: "1",
  shopId: "shop",
  productId: null,
  customerOrderDate: "2026-06-05",
  orderDate: "2026-06-05",
  productName: "쉬젤 팬",
  quantity: 1,
  ordererName: "홍길동",
  recipientName: "홍길동",
  contactPhone: "010-1234-5678",
  contactPhone2: "",
  postalCode: "12345",
  address: "서울 강남구 역삼동",
  shippingMemo: "",
  purchasePrice: 1000,
  shippingFee: 0,
  supplyTotal: 1000,
  celticDepositAmount: 1000,
  isRemoteArea: false,
  rawSmsText: "",
  status: "draft",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("order-search", () => {
  it("상품명·주문자·전화·주소 검색", () => {
    const o = sample();
    assert.ok(matchesOrderSearch(o, "쉬젤"));
    assert.ok(matchesOrderSearch(o, "홍길동"));
    assert.ok(matchesOrderSearch(o, "01012345678"));
    assert.ok(matchesOrderSearch(o, "역삼동"));
    assert.equal(matchesOrderSearch(o, "없는값"), false);
    assert.ok(matchesOrderSearch(o, ""));
  });
});
