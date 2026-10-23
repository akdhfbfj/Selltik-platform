import { test } from "node:test";
import assert from "node:assert/strict";
import { getFeedToken, isValidFeedToken, toFeed } from "../lib/todo-feed";
import type { WorkItem } from "../lib/types";

process.env.SESSION_SECRET = "test-secret";

const base: WorkItem = {
  id: "a",
  type: "inquiry",
  title: "배송 문의",
  body: "언제 오나요",
  authorType: "seller",
  authorName: "셀러",
  shopId: "s1",
  shopName: "○○상점",
  assignee: "",
  status: "open",
  createdAt: "2026-10-20T01:00:00Z",
  updatedAt: "2026-10-20T01:00:00Z",
  resolvedAt: "",
  replyCount: 0,
};

test("토큰은 SESSION_SECRET에서 만들고 맞는 것만 통과", () => {
  const t = getFeedToken();
  assert.match(t, /^[0-9a-f]{64}$/);
  assert.equal(isValidFeedToken(t), true);
  assert.equal(isValidFeedToken(t.slice(1)), false);
  assert.equal(isValidFeedToken(null), false);
});

test("미처리 전부 + 최근 14일 안에 처리된 것만 내보낸다", () => {
  const now = new Date("2026-10-23T00:00:00Z").getTime();
  const items: WorkItem[] = [
    base,
    { ...base, id: "b", status: "done", resolvedAt: "2026-10-22T00:00:00Z" },
    { ...base, id: "c", status: "done", resolvedAt: "2026-09-01T00:00:00Z" },
    { ...base, id: "d", status: "open", createdAt: "2026-01-01T00:00:00Z" },
  ];
  const feed = toFeed(items, now);
  assert.deepEqual(feed.map((f) => f.id), ["a", "b", "d"]);
  assert.equal("authorType" in feed[0], false);
});
