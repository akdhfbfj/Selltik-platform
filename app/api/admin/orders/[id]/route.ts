import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { formatOrderDbError, hideOrderFromAdmin } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ok = await hideOrderFromAdmin(id);
    if (!ok) {
      return NextResponse.json({ error: "발주를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg =
      e instanceof Error
        ? formatOrderDbError(e)
        : formatOrderDbError({ message: String(e) });
    return NextResponse.json({ error: msg || "숨김 처리에 실패했습니다." }, { status: 500 });
  }
}
