import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findDuplicateOrders,
  isDuplicateOrder,
  orderPersonKey,
} from "../lib/order-duplicates";
import type { Order } from "../lib/types";

const sample = (overrides: Partial<Order> = {}): Order => ({
  id: "1",
  shopId: "shop",
  productId: null,
  orderDate: "2026-06-05",
  productName: "상품",
  quantity: 1,
  ordererName: "홍길동",
  recipientName: "홍길동",
  contactPhone: "010-1234-5678",
  contactPhone2: "",
  postalCode: "12345",
  address: "서울",
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

describe("order-duplicates", () => {
  it("orderPersonKey ignores spaces and dashes", () => {
    assert.equal(
      orderPersonKey({
        ordererName: "홍 길동",
        recipientName: "홍길동",
        contactPhone: "01012345678",
      }),
      orderPersonKey({
        ordererName: "홍길동",
        recipientName: "홍 길 동",
        contactPhone: "010-1234-5678",
      })
    );
  });

  it("findDuplicateOrders matches same date and person", () => {
    const orders = [
      sample({ id: "a" }),
      sample({ id: "b", productName: "다른 상품" }),
      sample({
        id: "c",
        orderDate: "2026-06-06",
        ordererName: "홍길동",
      }),
    ];
    const hits = findDuplicateOrders(orders, {
      orderDate: "2026-06-05",
      ordererName: "홍길동",
      recipientName: "홍길동",
      contactPhone: "010-1234-5678",
    });
    assert.equal(hits.length, 2);
    assert.ok(isDuplicateOrder(orders, hits[0]));
  });
});
