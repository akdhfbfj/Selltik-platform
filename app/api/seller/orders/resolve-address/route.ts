import { NextResponse } from "next/server";
import { searchKakaoAddress } from "@/lib/kakao-address";
import { requireSellerShop } from "@/lib/seller";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { query } = (await request.json()) as { query?: string };
    if (!query?.trim()) {
      return NextResponse.json({ error: "주소를 입력해 주세요." }, { status: 400 });
    }

    const results = await searchKakaoAddress(query);
    return NextResponse.json({ results });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { error: err.message || "주소 검색에 실패했습니다." },
      { status: 500 }
    );
  }
}
