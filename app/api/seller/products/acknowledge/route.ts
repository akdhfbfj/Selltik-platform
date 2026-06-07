import { NextResponse } from "next/server";
import { acknowledgeProductReviews, formatDbError } from "@/lib/products";
import { requireSellerShop } from "@/lib/seller";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      productId?: string;
      productIds?: string[];
      all?: boolean;
    };

    if (body.all) {
      const count = await acknowledgeProductReviews(shop.id);
      return NextResponse.json({ success: true, count });
    }

    const ids = body.productIds?.length
      ? body.productIds
      : body.productId?.trim()
        ? [body.productId.trim()]
        : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "상품 ID가 필요합니다." }, { status: 400 });
    }

    const count = await acknowledgeProductReviews(shop.id, ids);
    return NextResponse.json({ success: true, count });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}
