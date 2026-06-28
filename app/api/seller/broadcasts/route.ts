import { NextResponse } from "next/server";
import {
  createBroadcast,
  getBroadcastsForMonth,
  formatGrowthDbError,
  getErrorMessage,
  currentMonthKey,
} from "@/lib/seller-growth";
import type { SellerBroadcastInput } from "@/lib/types";
import { requireSellerShop } from "@/lib/seller";

export async function GET(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json(
      { error: "셀러 로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const monthKey = searchParams.get("month") ?? currentMonthKey();

  try {
    const broadcasts = await getBroadcastsForMonth(shop.id, monthKey);
    return NextResponse.json({ monthKey, broadcasts });
  } catch (e) {
    return NextResponse.json(
      { error: formatGrowthDbError({ message: getErrorMessage(e) }) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json(
      { error: "셀러 로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as SellerBroadcastInput;
    if (!body.broadcastDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.broadcastDate)) {
      return NextResponse.json(
        { error: "방송 날짜(YYYY-MM-DD)를 입력해 주세요." },
        { status: 400 }
      );
    }
    const broadcast = await createBroadcast(shop.id, {
      broadcastDate: body.broadcastDate,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      revenue: Number(body.revenue ?? 0),
      memo: body.memo ?? "",
    });
    return NextResponse.json({ broadcast }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: formatGrowthDbError({ message: getErrorMessage(e) }) },
      { status: 500 }
    );
  }
}
