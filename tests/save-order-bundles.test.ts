import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrderDraftBundle } from "../lib/types";
import {
  chunkSaveItems,
  formatBulkSaveMessage,
  SAVE_CHUNK_MAX_LINES,
} from "../lib/save-order-bundles";

function makeItem(lineCount: number, id?: string) {
  const bundle: OrderDraftBundle = {
    customerOrderDate: "2026-07-09",
    orderDate: "2026-07-09",
    ordererName: "홍길동",
    recipientName: "홍길동",
    contactPhone: "010-1234-5678",
    contactPhone2: "",
    postalCode: "12345",
    address: "서울",
    shippingMemo: "",
    isRemoteArea: false,
    rawSmsText: "",
    status: "draft",
    lines: Array.from({ length: lineCount }, (_, i) => ({
      id: `line-${i}`,
      productId: null,
      productName: `상품${i + 1}`,
      quantity: 1,
      purchasePrice: 1000,
      shippingFee: 0,
      supplyTotal: 1000,
      celticDepositAmount: 1000,
      productMatch: {
        productId: null,
        officialName: null,
        matchedBy: "none" as const,
        consumerPrice: 0,
      },
    })),
  };
  return { id, bundle, label: `통${id ?? "x"}` };
}

describe("formatBulkSaveMessage", () => {
  it("returns success message when nothing failed", () => {
    assert.equal(
      formatBulkSaveMessage(47, 0),
      "47건 임시 발주서에 저장되었습니다."
    );
  });

  it("returns partial save message", () => {
    assert.equal(formatBulkSaveMessage(40, 7), "40건 저장됨 · 7건 실패");
  });
});

describe("chunkSaveItems", () => {
  it("keeps bundles intact and splits by line budget", () => {
    const items = [
      makeItem(25, "a"),
      makeItem(25, "b"),
      makeItem(10, "c"),
    ];
    const chunks = chunkSaveItems(items, 40);

    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].length, 1);
    assert.equal(chunks[0][0].id, "a");
    assert.equal(chunks[1].length, 2);
    assert.equal(chunks[1][0].id, "b");
    assert.equal(chunks[1][1].id, "c");
  });

  it("defaults to SAVE_CHUNK_MAX_LINES", () => {
    const items = Array.from({ length: 3 }, (_, i) => makeItem(20, String(i)));
    const chunks = chunkSaveItems(items);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].reduce((n, i) => n + i.bundle.lines.length, 0), 40);
  });
});
