import { NextResponse } from "next/server";
import { getAdminOrderList } from "@/lib/admin-order-stats";
import { currentMonthRange } from "@/lib/date-range";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const defaults = currentMonthRange();
    const from = searchParams.get("from") ?? defaults.from;
    const to = searchParams.get("to") ?? defaults.to;
    const shopId = searchParams.get("shopId") ?? undefined;

    const orders = await getAdminOrderList(from, to, shopId);
    return NextResponse.json({ orders, total: orders.length });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: err.message || "발주 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
