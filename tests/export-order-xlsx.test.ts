import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrderSheetRows,
  formatExportFileSuffix,
  formatOrderDateShort,
  orderExportFilename,
  sumCelticDeposit,
  sumSupplyTotal,
  toExcelDate,
} from "../lib/export-order-xlsx";
import type { Order } from "../lib/types";

const sampleOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "1",
  shopId: "shop",
  productId: null,
  customerOrderDate: "2026-06-04",
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
  const exportDate = "2026-06-08";

  it("14열 양식: A1 발주서, A2 쇼핑몰명, N열 셀틱 입금액", () => {
    const rows = buildOrderSheetRows("광고몰", [sampleOrder()], exportDate);
    assert.equal(rows[0][0], "발주서");
    assert.equal(rows[1].length, 14);
    assert.equal(rows[1][0], "광고몰");
    assert.equal(rows[1][13], "(단위:원)");
    assert.equal(rows[2][12], "계");
    assert.equal(rows[2][13], "셀틱 입금액");
    assert.equal(rows[2].length, 14);
    assert.equal(rows[3][13], 204000);
  });

  it("발주일자 yy-mm-dd, 동일 수신인 묶음도 배송메모 자동 기입 없음", () => {
    const rows = buildOrderSheetRows(
      "광고몰",
      [
        sampleOrder({ id: "a", productName: "상품1" }),
        sampleOrder({ id: "b", productName: "상품2" }),
      ],
      exportDate
    );
    assert.equal(rows[3][0], "26-06-08");
    assert.equal(rows[3][9], "");
    assert.equal(rows[4][9], "");
    assert.equal(rows[3][13], 408000);
    assert.equal(rows[4][13], "");
  });

  it("sumCelticDeposit equals sumSupplyTotal (M열 = N4 기준)", () => {
    const orders = [
      sampleOrder({ supplyTotal: 204000, celticDepositAmount: 204000 }),
      sampleOrder({ supplyTotal: 50000, celticDepositAmount: 99999 }),
    ];
    assert.equal(sumCelticDeposit(orders), sumSupplyTotal(orders));
    assert.equal(sumCelticDeposit(orders), 254000);
  });

  it("N4 uses supply_total even when celtic_deposit_amount differs", () => {
    const rows = buildOrderSheetRows(
      "광고몰",
      [sampleOrder({ supplyTotal: 100000, celticDepositAmount: 95000 })],
      exportDate
    );
    assert.equal(rows[3][12], 100000);
    assert.equal(rows[3][13], 100000);
  });

  it("formatOrderDateShort", () => {
    assert.equal(formatOrderDateShort("2026-06-05"), "26-06-05");
  });

  it("toExcelDate", () => {
    assert.equal(toExcelDate("2026-06-05"), 46178);
  });

  it("orderExportFilename uses ISO date without timezone drift", () => {
    assert.match(
      orderExportFilename("신밧드", "2026-06-08"),
      /\[발주\] 26\.6\.8\. 발주서\(신밧드\)\.xlsx/
    );
  });

  it("orderExportFilename same-day suffix A, B", () => {
    assert.match(
      orderExportFilename("띵동이네", "2026-06-09", { suffix: "A" }),
      /발주서\(띵동이네\)A\.xlsx/
    );
    assert.match(
      orderExportFilename("띵동이네", "2026-06-09", { suffix: "B" }),
      /발주서\(띵동이네\)B\.xlsx/
    );
  });

  it("formatExportFileSuffix", () => {
    assert.equal(formatExportFileSuffix(0), "");
    assert.equal(formatExportFileSuffix(1), "A");
    assert.equal(formatExportFileSuffix(2), "B");
    assert.equal(formatExportFileSuffix(3), "C");
  });

  it("sumSupplyTotal", () => {
    assert.equal(
      sumSupplyTotal([
        sampleOrder({ supplyTotal: 100000 }),
        sampleOrder({ supplyTotal: 50000 }),
      ]),
      150000
    );
  });

});
