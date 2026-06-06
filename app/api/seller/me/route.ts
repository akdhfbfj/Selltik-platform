import { NextResponse } from "next/server";
import { getSellerSession } from "@/lib/supabase/server-auth";
import { getShopByAuthUserId } from "@/lib/shops";

export async function GET() {
  const user = await getSellerSession();
  if (!user) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  const shop = await getShopByAuthUserId(user.id);
  if (!shop) {
    return NextResponse.json(
      { error: "연결된 쇼핑몰이 없습니다. 셀틱에 문의하세요." },
      { status: 403 }
    );
  }

  return NextResponse.json({ shop, email: user.email });
}
