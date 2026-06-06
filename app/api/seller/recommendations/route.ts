import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createRecommendation,
  getRecommendationsByShopId,
} from "@/lib/db";
import { requireSellerShop } from "@/lib/seller";
import type { RecommendationInput } from "@/lib/types";

export async function GET() {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const recommendations = await getRecommendationsByShopId(shop.id);
    return NextResponse.json({ recommendations });
  } catch {
    return NextResponse.json(
      { error: "추천 목록을 불러오지 못했습니다." },
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
    const body = (await request.json()) as Omit<RecommendationInput, "sellerName" | "shopId">;
    if (!body.productName?.trim()) {
      return NextResponse.json({ error: "상품명은 필수입니다." }, { status: 400 });
    }

    const rec = await createRecommendation(uuidv4(), {
      ...body,
      sellerName: shop.name,
      shopId: shop.id,
    });
    return NextResponse.json(rec, { status: 201 });
  } catch {
    return NextResponse.json({ error: "추천 등록에 실패했습니다." }, { status: 500 });
  }
}
