import { NextResponse } from "next/server";
import { getAdminOrderStats } from "@/lib/admin-order-stats";
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

    const stats = await getAdminOrderStats(from, to);
    return NextResponse.json(stats);
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: err.message || "발주 통계를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
