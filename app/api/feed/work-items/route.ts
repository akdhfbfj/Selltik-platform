import { NextResponse } from "next/server";
import { getAllWorkItems } from "@/lib/work-items";
import { isValidFeedToken, toFeed, TODO_FEED_ORIGINS } from "@/lib/todo-feed";

// 토도 앱 전용 읽기 주소. Authorization: Bearer <토큰> (토큰: /api/admin/feed-token)
export const dynamic = "force-dynamic";

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (!TODO_FEED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  const headers = corsHeaders(request);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!isValidFeedToken(token)) {
    return NextResponse.json({ error: "토큰이 올바르지 않습니다." }, { status: 401, headers });
  }
  try {
    const items = toFeed(await getAllWorkItems());
    return NextResponse.json({ items }, { headers: { ...headers, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500, headers });
  }
}
