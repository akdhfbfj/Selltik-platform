import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_NAME_COOKIE,
  getSessionToken,
  isAdminAuthConfigured,
  isValidAdminName,
  SESSION_COOKIE,
  verifyPin,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      { error: "관리자 로그인이 설정되지 않았습니다. ADMIN_PIN·SESSION_SECRET을 확인하세요." },
      { status: 503 }
    );
  }

  const { pin, name } = (await request.json()) as { pin: string; name: string };

  if (!verifyPin(pin)) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }
  if (!isValidAdminName(name)) {
    return NextResponse.json({ error: "닉네임을 선택해주세요." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const maxAge = 60 * 60 * 24 * 365; // 기기별 자동 로그인: 명시적 로그아웃 전까지 재로그인 요구하지 않음
  cookieStore.set(SESSION_COOKIE, getSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  cookieStore.set(ADMIN_NAME_COOKIE, name, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return NextResponse.json({ success: true });
}
