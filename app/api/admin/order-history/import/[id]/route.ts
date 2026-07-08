import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  confirmImportedOrderBatch,
  deleteImportedOrderBatch,
} from "@/lib/import-order-history";
import { formatDbError } from "@/lib/products";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ok = await confirmImportedOrderBatch(id);
    if (!ok) {
      return NextResponse.json(
        { error: "발주 묶음을 찾을 수 없거나 이미 확인되었습니다." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatDbError(err) || "확인 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ok = await deleteImportedOrderBatch(id);
    if (!ok) {
      return NextResponse.json({ error: "발주 묶음을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatDbError(err) || "삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
