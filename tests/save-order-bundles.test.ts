import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatBulkSaveMessage } from "../lib/save-order-bundles";

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
