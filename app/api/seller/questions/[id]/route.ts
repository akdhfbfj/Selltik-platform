import { NextResponse } from "next/server";
import { requireSellerShop } from "@/lib/seller";
import { getWorkItemById, getWorkItemReplies } from "@/lib/work-items";

export async function GET(
  _request: Request,
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
    const replies = await getWorkItemReplies(id);
    return NextResponse.json({ item, replies });
  } catch {
    return NextResponse.json(
      { error: "불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
