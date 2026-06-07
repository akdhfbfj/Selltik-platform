import { NextResponse } from "next/server";
import { buildOrderDraft, formatOrderDbError } from "@/lib/orders";
import { parseOrderSms } from "@/lib/parse-order-sms";
import { requireSellerShop } from "@/lib/seller";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { text } = (await request.json()) as { text?: string };
    if (!text?.trim()) {
      return NextResponse.json(
        { error: "문자 내용을 붙여넣어 주세요." },
        { status: 400 }
      );
    }

    const parsed = parseOrderSms(text);
    const draft = await buildOrderDraft(shop.id, parsed, text);
    return NextResponse.json({ parsed, draft });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}
