import { NextResponse } from "next/server";
import { updateWorkItemStatus } from "@/lib/work-items";
import { bearerToken, isTodoStatus, isValidFeedToken, todoCorsHeaders } from "@/lib/todo-feed";

// 토도에서 완료하면 게시판 상태도 완료로(되돌리면 대기로). PATCH { status: "done" | "open" }
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: todoCorsHeaders(request) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = todoCorsHeaders(request);
  if (!isValidFeedToken(bearerToken(request))) {
    return NextResponse.json({ error: "토큰이 올바르지 않습니다." }, { status: 401, headers });
  }
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { status?: unknown };
    if (!isTodoStatus(body.status)) {
      return NextResponse.json({ error: "잘못된 상태값입니다." }, { status: 400, headers });
    }
    const item = await updateWorkItemStatus(id, body.status);
    if (!item) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404, headers });
    }
    return NextResponse.json({ id: item.id, status: item.status }, { headers });
  } catch {
    return NextResponse.json({ error: "상태를 바꾸지 못했습니다." }, { status: 500, headers });
  }
}
