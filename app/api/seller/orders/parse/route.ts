import { NextResponse } from "next/server";
import { buildOrderDraftBundle, formatOrderDbError } from "@/lib/orders";
import { getSellerProductViews } from "@/lib/products";
import { refineOrderDraftBundle } from "@/lib/refine-order-draft";
import { parseOrderSmsWithLearning } from "@/lib/sms-parse-learn";
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

    const parsed = await parseOrderSmsWithLearning(text, shop.id);
    const products = await getSellerProductViews(shop.id);
    const rawDraftBundle = await buildOrderDraftBundle(shop.id, parsed, text, {
      rawOnly: true,
      products,
    });

    const { bundle: draftBundle, changes } = await refineOrderDraftBundle(
      rawDraftBundle,
      products
    );

    return NextResponse.json({
      parsed,
      rawDraftBundle,
      draftBundle,
      changes,
      autoRefined: true,
    });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}
