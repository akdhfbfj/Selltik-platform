import { NextResponse } from "next/server";
import { formatOrderDbError } from "@/lib/orders";
import { getSellerProductViews } from "@/lib/products";
import { refineOrderDraftBundle } from "@/lib/refine-order-draft";
import { requireSellerShop } from "@/lib/seller";
import type { OrderDraftBundle } from "@/lib/types";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { bundle } = (await request.json()) as { bundle?: OrderDraftBundle };
    if (!bundle?.lines?.length) {
      return NextResponse.json(
        { error: "반영할 분석 결과가 없습니다." },
        { status: 400 }
      );
    }

    const products = await getSellerProductViews(shop.id);
    const { bundle: refined, changes } = await refineOrderDraftBundle(
      bundle,
      products
    );

    return NextResponse.json({ draftBundle: refined, changes });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}
