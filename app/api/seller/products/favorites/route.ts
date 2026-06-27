import { NextResponse } from "next/server";
import { setSellerProductFavorite } from "@/lib/products";
import { requireSellerShop } from "@/lib/seller";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      productId?: string;
      favorite?: boolean;
    };
    if (!body.productId?.trim()) {
      return NextResponse.json({ error: "상품 ID가 필요합니다." }, { status: 400 });
    }
    if (typeof body.favorite !== "boolean") {
      return NextResponse.json({ error: "favorite 값이 필요합니다." }, { status: 400 });
    }

    await setSellerProductFavorite(shop.id, body.productId.trim(), body.favorite);
    return NextResponse.json({ success: true, favorite: body.favorite });
  } catch {
    return NextResponse.json(
      { error: "인기 상품 설정에 실패했습니다." },
      { status: 500 }
    );
  }
}
