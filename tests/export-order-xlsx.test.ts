import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrderSheetRows,
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
  it("첫 데이터 행에만 셀틱 입금액 합계", () => {
    const rows = buildOrderSheetRows("띵동이네", [
      sampleOrder({ id: "a", supplyTotal: 102000, celticDepositAmount: 102000 }),
      sampleOrder({ id: "b", supplyTotal: 50000, celticDepositAmount: 50000 }),
    ]);
    const firstData = rows[3];
    const secondData = rows[4];
    assert.equal(firstData[13], 152000);
    assert.equal(secondData[13], "");
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

  it("toExcelDate", () => {
    assert.equal(toExcelDate("2026-06-05"), 46178);
  });
});
