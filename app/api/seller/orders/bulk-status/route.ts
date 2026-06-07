import { NextResponse } from "next/server";
import { formatOrderDbError, patchOrdersStatus } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";
import { requireSellerShop } from "@/lib/seller";

const ALLOWED: OrderStatus[] = ["draft", "paid", "exported", "confirmed"];

export async function PATCH(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { orderIds, status } = (await request.json()) as {
      orderIds?: string[];
      status?: OrderStatus;
    };

    if (!orderIds?.length) {
      return NextResponse.json(
        { error: "선택한 발주가 없습니다." },
        { status: 400 }
      );
    }
    if (!status || !ALLOWED.includes(status)) {
      return NextResponse.json(
        { error: "유효하지 않은 상태입니다." },
        { status: 400 }
      );
    }

    const orders = await patchOrdersStatus(shop.id, orderIds, status);
    return NextResponse.json({ orders, count: orders.length });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}
