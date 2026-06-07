import { NextResponse } from "next/server";
import { updateShopSmsSettings } from "@/lib/shops";
import type { ShopSmsSettings } from "@/lib/types";
import { requireSellerShop } from "@/lib/seller";

export async function GET() {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({
    smsHeader: shop.smsHeader,
    smsFooter: shop.smsFooter,
  });
}

export async function PUT(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ShopSmsSettings;
    const updated = await updateShopSmsSettings(shop.id, {
      smsHeader: body.smsHeader ?? "",
      smsFooter: body.smsFooter ?? "",
    });
    if (!updated) {
      return NextResponse.json({ error: "설정을 저장하지 못했습니다." }, { status: 500 });
    }
    return NextResponse.json({
      smsHeader: updated.smsHeader,
      smsFooter: updated.smsFooter,
    });
  } catch {
    return NextResponse.json({ error: "설정 저장에 실패했습니다." }, { status: 500 });
  }
}
