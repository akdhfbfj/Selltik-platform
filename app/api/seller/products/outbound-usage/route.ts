import { NextResponse } from "next/server";
import { formatDbError, recordOutboundProductUsage } from "@/lib/products";
import { requireSellerShop } from "@/lib/seller";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { productIds?: string[] };
    if (!Array.isArray(body.productIds)) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    await recordOutboundProductUsage(shop.id, body.productIds);
    return NextResponse.json({ success: true });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}
