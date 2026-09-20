import { NextResponse } from "next/server";
import { requireSellerShop } from "@/lib/seller";
import { addWorkItemReply, getWorkItemById } from "@/lib/work-items";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const item = await getWorkItemById(id);
    if (!item || item.shopId !== shop.id) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }

    const { body } = (await request.json()) as { body: string };
    if (!body?.trim()) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    const reply = await addWorkItemReply(id, "seller", shop.name, body);
    return NextResponse.json(reply, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "답변 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
