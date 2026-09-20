import { NextResponse } from "next/server";
import { getAdminName, requireAuth } from "@/lib/auth";
import { addWorkItemReply } from "@/lib/work-items";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { body } = (await request.json()) as { body: string };
    if (!body?.trim()) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    const authorName = await getAdminName();
    if (!authorName) {
      return NextResponse.json(
        { error: "닉네임 확인이 필요합니다. 새로고침 후 다시 시도해주세요." },
        { status: 400 }
      );
    }

    const reply = await addWorkItemReply(id, "admin", authorName, body);
    return NextResponse.json(reply, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "답변 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
