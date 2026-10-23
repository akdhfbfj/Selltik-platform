import { NextResponse } from "next/server";
import { getAllWorkItems } from "@/lib/work-items";
import { bearerToken, isValidFeedToken, todoCorsHeaders, toFeed } from "@/lib/todo-feed";

// 토도 앱 전용 읽기 주소. Authorization: Bearer <토큰> (토큰: /api/admin/feed-token)
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: todoCorsHeaders(request) });
}

export async function GET(request: Request) {
  const headers = todoCorsHeaders(request);
  if (!isValidFeedToken(bearerToken(request))) {
    return NextResponse.json({ error: "토큰이 올바르지 않습니다." }, { status: 401, headers });
  }
  try {
    const items = toFeed(await getAllWorkItems());
    return NextResponse.json({ items }, { headers: { ...headers, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500, headers });
  }
}
