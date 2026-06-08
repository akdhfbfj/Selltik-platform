import { NextResponse } from "next/server";
import { createOrder, formatOrderDbError } from "@/lib/orders";
import type { OrderDraftPreview } from "@/lib/types";
import { requireSellerShop } from "@/lib/seller";

const BULK_CREATE_MAX = 200;

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { orders } = (await request.json()) as { orders?: OrderDraftPreview[] };
    if (!orders?.length) {
      return NextResponse.json(
        { error: "저장할 발주가 없습니다." },
        { status: 400 }
      );
    }
    if (orders.length > BULK_CREATE_MAX) {
      return NextResponse.json(
        { error: `한 번에 최대 ${BULK_CREATE_MAX}건까지 저장할 수 있습니다.` },
        { status: 400 }
      );
    }

    let created = 0;
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < orders.length; i++) {
      const body = orders[i];
      if (!body.productName?.trim()) {
        errors.push({ index: i, error: "상품명이 비어 있습니다." });
        continue;
      }
      try {
        await createOrder(shop.id, body);
        created++;
      } catch (e) {
        const err = e as { message?: string };
        errors.push({ index: i, error: formatOrderDbError(err) });
      }
    }

    if (created === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: errors[0].error, created: 0, errors },
        { status: 500 }
      );
    }

    return NextResponse.json({ created, errors });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}
