import { NextResponse } from "next/server";
import {
  countPendingProductReviews,
  getSellerProductViews,
  upsertSellerAliases,
} from "@/lib/products";
import { requireSellerShop } from "@/lib/seller";

export async function GET() {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const [products, pendingReviewCount] = await Promise.all([
      getSellerProductViews(shop.id),
      countPendingProductReviews(shop.id),
    ]);
    return NextResponse.json({ products, total: products.length, pendingReviewCount });
  } catch {
    return NextResponse.json(
      { error: "상품 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { aliases } = (await request.json()) as {
      aliases: { productId: string; smsName: string }[];
    };
    if (!Array.isArray(aliases)) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    await upsertSellerAliases(shop.id, aliases);
    const products = await getSellerProductViews(shop.id);
    return NextResponse.json({ success: true, products });
  } catch {
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
