import { NextResponse } from "next/server";
import { formatDbError, setSellerProductHidden } from "@/lib/products";
import { requireSellerShop } from "@/lib/seller";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      productId?: string;
      hidden?: boolean;
    };
    if (!body.productId?.trim()) {
      return NextResponse.json({ error: "상품 ID가 필요합니다." }, { status: 400 });
    }
    if (typeof body.hidden !== "boolean") {
      return NextResponse.json({ error: "hidden 값이 필요합니다." }, { status: 400 });
    }

    await setSellerProductHidden(shop.id, body.productId.trim(), body.hidden);
    return NextResponse.json({ success: true, hidden: body.hidden });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatDbError(err) || "상품 숨김 설정에 실패했습니다." },
      { status: 500 }
    );
  }
}
