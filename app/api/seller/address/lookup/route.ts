import { NextResponse } from "next/server";
import { resolvePostalCodeFromAddress } from "@/lib/resolve-postal-code";
import { searchKakaoAddress } from "@/lib/kakao-address";
import { requireSellerShop } from "@/lib/seller";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { address } = (await request.json()) as { address?: string };
    if (!address?.trim()) {
      return NextResponse.json({ error: "주소를 입력해주세요." }, { status: 400 });
    }

    const results = await searchKakaoAddress(address);
    const postalCode = await resolvePostalCodeFromAddress(address);
    const best = results[0];

    return NextResponse.json({
      postalCode,
      address: best?.address ?? address.trim(),
      candidates: results,
    });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: err.message || "주소 검색에 실패했습니다." },
      { status: 500 }
    );
  }
}
