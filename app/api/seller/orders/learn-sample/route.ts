import { NextResponse } from "next/server";
import { bundleToLearnOrderInput } from "@/lib/reply-learn-sample";
import { requireSellerShop } from "@/lib/seller";
import { saveSmsParseSample } from "@/lib/sms-parse-samples";
import type { OrderDraftBundle } from "@/lib/types";
import type { ParsedOrderSms } from "@/lib/parse-order-sms";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      rawSmsText?: string;
      autoParsed?: ParsedOrderSms;
      sellerBundle?: OrderDraftBundle;
    };

    if (!body.rawSmsText?.trim() || !body.autoParsed || !body.sellerBundle) {
      return NextResponse.json(
        { error: "학습에 필요한 분석·수정 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const sellerFinal = bundleToLearnOrderInput({
      ...body.sellerBundle,
      rawSmsText: body.rawSmsText.trim(),
    });

    await saveSmsParseSample({
      shopId: shop.id,
      orderId: null,
      rawSmsText: body.rawSmsText.trim(),
      autoParsed: body.autoParsed,
      sellerFinal,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: err.message || "학습 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
