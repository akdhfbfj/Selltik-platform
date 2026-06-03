import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionToken, SESSION_COOKIE, verifyPin } from "@/lib/auth";

export async function POST(request: Request) {
  const { pin } = (await request.json()) as { pin: string };

  if (!verifyPin(pin)) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, getSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ success: true });
}
