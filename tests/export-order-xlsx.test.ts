import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrderSheetRows,
  formatOrderDateShort,
  sumCelticDeposit,
  toExcelDate,
} from "../lib/export-order-xlsx";
import type { Order } from "../lib/types";

const sampleOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "1",
  shopId: "shop",
  productId: null,
  orderDate: "2026-06-05",
  productName: "테스트 상품",
  quantity: 2,
  ordererName: "홍길동",
  recipientName: "홍길동",
  contactPhone: "010-1234-5678",
  contactPhone2: "",
  postalCode: "12345",
  address: "서울시 강남구",
  shippingMemo: "",
  purchasePrice: 196000,
  shippingFee: 8000,
  supplyTotal: 204000,
  celticDepositAmount: 204000,
  isRemoteArea: false,
  rawSmsText: "",
  status: "draft",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("export-order-xlsx", () => {
  it("13열 양식: A1 발주서, A2 쇼핑몰명", () => {
    const rows = buildOrderSheetRows("광고몰", [sampleOrder()]);
    assert.equal(rows[0][0], "발주서");
    assert.equal(rows[1].length, 13);
    assert.equal(rows[1][0], "광고몰");
    assert.equal(rows[1][12], "(단위:원)");
    assert.equal(rows[2][12], "계");
    assert.equal(rows[2].length, 13);
  });

  it("발주일자 yy-mm-dd, 묶음배송 메모", () => {
    const rows = buildOrderSheetRows("광고몰", [
      sampleOrder({ id: "a", productName: "상품1" }),
      sampleOrder({ id: "b", productName: "상품2" }),
    ]);
    assert.equal(rows[3][0], "26-06-05");
    assert.equal(rows[3][9], "묶음배송");
    assert.equal(rows[4][9], "묶음배송");
  });

  it("sumCelticDeposit", () => {
    assert.equal(
      sumCelticDeposit([
        sampleOrder({ celticDepositAmount: 204000 }),
        sampleOrder({ celticDepositAmount: 50000 }),
      ]),
      254000
    );
  });

  it("formatOrderDateShort", () => {
    assert.equal(formatOrderDateShort("2026-06-05"), "26-06-05");
  });

  it("toExcelDate", () => {
    assert.equal(toExcelDate("2026-06-05"), 46178);
  });
});
