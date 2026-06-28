import { NextResponse } from "next/server";
import {
  currentMonthKey,
  currentDateKey,
  getSellerGrowthDashboard,
  setMonthlyTarget,
  setDailyTarget,
  formatGrowthDbError,
  getErrorMessage,
} from "@/lib/seller-growth";
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
    const data = await getSellerGrowthDashboard(shop.id, monthKey);
    return NextResponse.json({ monthKey, ...data });
  } catch (e) {
    return NextResponse.json(
      { error: formatGrowthDbError({ message: getErrorMessage(e) }) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json(
      { error: "셀러 로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as {
      scope?: "monthly" | "daily";
      monthKey?: string;
      dateKey?: string;
      targetRevenue?: number;
    };
    const scope = body.scope ?? "monthly";
    const targetRevenue = Number(body.targetRevenue ?? 0);

    if (scope === "daily") {
      const dateKey = body.dateKey ?? currentDateKey();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return NextResponse.json(
          { error: "dateKey는 YYYY-MM-DD 형식이어야 합니다." },
          { status: 400 }
        );
      }
      const saved = await setDailyTarget(shop.id, dateKey, targetRevenue);
      return NextResponse.json({ dateKey, targetRevenue: saved });
    }

    const monthKey = body.monthKey ?? currentMonthKey();
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json(
        { error: "monthKey는 YYYY-MM 형식이어야 합니다." },
        { status: 400 }
      );
    }
    const saved = await setMonthlyTarget(shop.id, monthKey, targetRevenue);
    return NextResponse.json({ monthKey, targetRevenue: saved });
  } catch (e) {
    return NextResponse.json(
      { error: formatGrowthDbError({ message: getErrorMessage(e) }) },
      { status: 500 }
    );
  }
}
