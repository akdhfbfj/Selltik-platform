import { NextResponse } from "next/server";
import {
  deleteOrder,
  formatOrderDbError,
  updateOrder,
} from "@/lib/orders";
import type { OrderInput } from "@/lib/types";
import { requireSellerShop } from "@/lib/seller";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as OrderInput;
    const order = await updateOrder(shop.id, id, body);
    if (!order) {
      return NextResponse.json({ error: "발주를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ok = await deleteOrder(shop.id, id);
    if (!ok) {
      return NextResponse.json({ error: "발주를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}
