import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getWorkItemById,
  getWorkItemReplies,
  updateWorkItemStatus,
} from "@/lib/work-items";
import type { WorkItemStatus } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const item = await getWorkItemById(id);
    if (!item) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }
    const replies = await getWorkItemReplies(id);
    return NextResponse.json({ item, replies });
  } catch {
    return NextResponse.json(
      { error: "불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status } = (await request.json()) as { status: WorkItemStatus };
    if (!["open", "answered", "done"].includes(status)) {
      return NextResponse.json({ error: "잘못된 상태값입니다." }, { status: 400 });
    }
    const item = await updateWorkItemStatus(id, status);
    if (!item) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "변경에 실패했습니다." }, { status: 500 });
  }
}
