import test from "node:test";
import assert from "node:assert/strict";
import { collectImportWarnings } from "../lib/sms-import-batch";
import type { OrderDraftBundle } from "../lib/types";

function emptyBundle(overrides: Partial<OrderDraftBundle> = {}): OrderDraftBundle {
  return {
    customerOrderDate: "2024-06-06",
    orderDate: "2024-06-06",
    ordererName: "홍길동",
    recipientName: "홍길동",
    contactPhone: "01012345678",
    contactPhone2: "",
    postalCode: "",
    address: "서울 강남구",
    shippingMemo: "",
    isRemoteArea: false,
    rawSmsText: "test",
    status: "draft",
    lines: [
      {
        id: "1",
        productId: null,
        productName: "쉬젤 팬",
        quantity: 1,
        purchasePrice: 1000,
        shippingFee: 0,
        supplyTotal: 1000,
        celticDepositAmount: 1000,
        productMatch: {
          productId: "p1",
          officialName: "팬",
          matchedBy: "sms_alias",
          consumerPrice: 2000,
        },
      },
    ],
    ...overrides,
  };
}

test("collectImportWarnings: 정상 건은 경고 없음", () => {
  assert.deepEqual(collectImportWarnings(emptyBundle(), 0), []);
});

test("collectImportWarnings: 누락·미매칭·중복", () => {
  const w = collectImportWarnings(
    emptyBundle({
      contactPhone: "",
      address: "",
      lines: [
        {
          id: "1",
          productId: null,
          productName: "미등록상품",
          quantity: 1,
          purchasePrice: 0,
          shippingFee: 0,
          supplyTotal: 0,
          celticDepositAmount: 0,
          productMatch: {
            productId: null,
            officialName: null,
            matchedBy: "none",
            consumerPrice: 0,
          },
        },
      ],
    }),
    2
  );
  assert.ok(w.includes("연락처 없음"));
  assert.ok(w.includes("주소 없음"));
  assert.ok(w.includes("상품 미매칭 1건"));
  assert.ok(w.includes("기존 발주 2건과 중복"));
});
