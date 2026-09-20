import { NextResponse } from "next/server";
import { requireSellerShop } from "@/lib/seller";
import { createWorkItem, getWorkItemsForShop } from "@/lib/work-items";
import type { WorkItemInput } from "@/lib/types";

export async function GET() {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const items = await getWorkItemsForShop(shop.id);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: "문의 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as WorkItemInput;
    if (!body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json(
        { error: "제목과 내용은 필수입니다." },
        { status: 400 }
      );
    }

    const item = await createWorkItem(
      { ...body, type: "inquiry" },
      "seller",
      shop.name,
      shop.id
    );
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "등록에 실패했습니다." }, { status: 500 });
  }
}
