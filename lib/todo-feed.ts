/**
 * 토도(개인 할 일 앱) 연동: 업무·문의 게시판을 읽기 전용으로 내보낸다.
 * 토큰은 SESSION_SECRET에서 만들어 새 환경변수가 필요 없다. 운영진은 /api/admin/feed-token 에서 확인.
 * SESSION_SECRET을 바꾸면 토큰도 바뀐다(토도 설정에 다시 붙여넣기).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSessionToken } from "./auth";
import type { WorkItem } from "./types";

export const TODO_FEED_ORIGINS = [
  "https://todo-dodo-2610.web.app",
  "https://todo-dodo-2610.firebaseapp.com",
  "http://localhost:5200",
];

export function getFeedToken(): string {
  return createHmac("sha256", getSessionToken()).update("todo-feed-v1").digest("hex");
}

export function isValidFeedToken(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(getFeedToken());
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface FeedItem {
  id: string;
  type: WorkItem["type"];
  title: string;
  body: string;
  shopName: string;
  authorName: string;
  assignee: string;
  status: WorkItem["status"];
  createdAt: string;
  resolvedAt: string;
}

/** 미처리(open) 전부 + 최근 14일 안에 처리된 것(토도에서 자동 완료 처리용) */
export function toFeed(items: WorkItem[], now = Date.now()): FeedItem[] {
  const since = now - 14 * 24 * 60 * 60 * 1000;
  return items
    .filter(
      (it) =>
        it.status === "open" ||
        new Date(it.resolvedAt || it.updatedAt).getTime() >= since
    )
    .map((it) => ({
      id: it.id,
      type: it.type,
      title: it.title,
      body: it.body,
      shopName: it.shopName,
      authorName: it.authorName,
      assignee: it.assignee,
      status: it.status,
      createdAt: it.createdAt,
      resolvedAt: it.resolvedAt,
    }));
}
