import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getFeedToken } from "@/lib/todo-feed";

// 운영진 로그인 상태에서 열면 토도 연동 토큰을 보여준다(토도 설정 → 셀틱 연결에 붙여넣기)
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json({ token: getFeedToken() }, { headers: { "Cache-Control": "no-store" } });
}
