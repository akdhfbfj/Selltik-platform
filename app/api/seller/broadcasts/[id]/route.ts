import { NextResponse } from "next/server";
import {
  deleteBroadcast,
  updateBroadcast,
  formatGrowthDbError,
  getErrorMessage,
} from "@/lib/seller-growth";
import type { SellerBroadcastInput } from "@/lib/types";
import { requireSellerShop } from "@/lib/seller";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json(
      { error: "셀러 로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const body = (await request.json()) as Partial<SellerBroadcastInput>;
    const broadcast = await updateBroadcast(shop.id, id, body);
    if (!broadcast) {
      return NextResponse.json(
        { error: "방송 기록을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    return NextResponse.json({ broadcast });
  } catch (e) {
    return NextResponse.json(
      { error: formatGrowthDbError({ message: getErrorMessage(e) }) },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json(
      { error: "셀러 로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const ok = await deleteBroadcast(shop.id, id);
    if (!ok) {
      return NextResponse.json(
        { error: "방송 기록을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: formatGrowthDbError({ message: getErrorMessage(e) }) },
      { status: 500 }
    );
  }
}
