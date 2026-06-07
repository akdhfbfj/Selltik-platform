import { NextResponse } from "next/server";
import {
  createOrder,
  formatOrderDbError,
  getOrdersByShop,
} from "@/lib/orders";
import type { OrderDraftPreview } from "@/lib/types";
import { requireSellerShop } from "@/lib/seller";

export async function GET() {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const orders = await getOrdersByShop(shop.id);
    return NextResponse.json({ orders, total: orders.length });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as OrderDraftPreview;
    if (!body.productName?.trim()) {
      return NextResponse.json({ error: "상품명은 필수입니다." }, { status: 400 });
    }

    const order = await createOrder(shop.id, body);
    return NextResponse.json(order, { status: 201 });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}
