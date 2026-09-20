import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  deleteWorkItem,
  getWorkItemById,
  getWorkItemReplies,
  updateWorkItem,
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
    const body = (await request.json()) as {
      status?: WorkItemStatus;
      title?: string;
      body?: string;
      assignee?: string;
    };

    if (body.status !== undefined) {
      if (!["open", "answered", "done"].includes(body.status)) {
        return NextResponse.json({ error: "잘못된 상태값입니다." }, { status: 400 });
      }
      const item = await updateWorkItemStatus(id, body.status);
      if (!item) {
        return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json(item);
    }

    if (body.title !== undefined && !body.title.trim()) {
      return NextResponse.json({ error: "제목은 필수입니다." }, { status: 400 });
    }
    if (body.body !== undefined && !body.body.trim()) {
      return NextResponse.json({ error: "내용은 필수입니다." }, { status: 400 });
    }

    const item = await updateWorkItem(id, {
      title: body.title,
      body: body.body,
      assignee: body.assignee,
    });
    if (!item) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "변경에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const deleted = await deleteWorkItem(id);
    if (!deleted) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
}
