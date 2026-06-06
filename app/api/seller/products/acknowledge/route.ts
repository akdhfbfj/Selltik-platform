import { NextResponse } from "next/server";
import { acknowledgeProductReview, formatDbError } from "@/lib/products";
import { requireSellerShop } from "@/lib/seller";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { productId } = (await request.json()) as { productId?: string };
    if (!productId?.trim()) {
      return NextResponse.json({ error: "상품 ID가 필요합니다." }, { status: 400 });
    }

    await acknowledgeProductReview(shop.id, productId);
    return NextResponse.json({ success: true });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}
