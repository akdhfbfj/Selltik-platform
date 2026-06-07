import { NextResponse } from "next/server";
import { formatOrderDbError, patchOrderStatus } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";
import { requireSellerShop } from "@/lib/seller";

type Params = { params: Promise<{ id: string }> };

const ALLOWED: OrderStatus[] = ["draft", "paid", "exported", "confirmed"];

export async function PATCH(request: Request, { params }: Params) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status } = (await request.json()) as { status?: OrderStatus };
    if (!status || !ALLOWED.includes(status)) {
      return NextResponse.json(
        { error: "유효하지 않은 상태입니다." },
        { status: 400 }
      );
    }

    const order = await patchOrderStatus(shop.id, id, status);
    if (!order) {
      return NextResponse.json({ error: "발주를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}
