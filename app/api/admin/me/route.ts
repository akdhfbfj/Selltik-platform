import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_NAME_COOKIE,
  getAdminName,
  isValidAdminName,
  requireAuth,
} from "@/lib/auth";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json({ name: await getAdminName() });
}

// 닉네임 도입 이전에 로그인한 세션을 위한 자가 복구용 — 새 로그인은 /api/auth/login에서 처리
export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { name } = (await request.json()) as { name: string };
  if (!isValidAdminName(name)) {
    return NextResponse.json({ error: "닉네임을 선택해주세요." }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_NAME_COOKIE, name, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ name });
}
