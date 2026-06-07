import { NextResponse } from "next/server";
import { updateSellerRecommendation } from "@/lib/db";
import { requireSellerShop } from "@/lib/seller";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as {
      productName?: string;
      brand?: string;
      desiredPrice?: string;
      referenceUrl?: string;
    };

    if (!body.productName?.trim()) {
      return NextResponse.json({ error: "상품명은 필수입니다." }, { status: 400 });
    }

    const rec = await updateSellerRecommendation(id, shop.id, {
      productName: body.productName,
      brand: body.brand,
      desiredPrice: body.desiredPrice,
      referenceUrl: body.referenceUrl,
    });

    if (!rec) {
      return NextResponse.json(
        { error: "수정할 수 없는 추천이거나 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ recommendation: rec });
  } catch {
    return NextResponse.json({ error: "수정에 실패했습니다." }, { status: 500 });
  }
}
