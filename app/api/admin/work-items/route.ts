import { NextResponse } from "next/server";
import { getAdminName, requireAuth } from "@/lib/auth";
import { createWorkItem, getAllWorkItems } from "@/lib/work-items";
import type { WorkItemInput, WorkItemStatus, WorkItemType } from "@/lib/types";

export async function GET(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as WorkItemType | null;
    const status = searchParams.get("status") as WorkItemStatus | null;
    const items = await getAllWorkItems({
      type: type || undefined,
      status: status || undefined,
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: "목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as WorkItemInput;
    if (!body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json(
        { error: "제목과 내용은 필수입니다." },
        { status: 400 }
      );
    }

    const authorName = await getAdminName();
    if (!authorName) {
      return NextResponse.json(
        { error: "닉네임 확인이 필요합니다. 새로고침 후 다시 시도해주세요." },
        { status: 400 }
      );
    }

    const item = await createWorkItem(
      { ...body, type: "task" },
      "admin",
      authorName,
      null
    );
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "등록에 실패했습니다." }, { status: 500 });
  }
}
