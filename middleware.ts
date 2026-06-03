import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionToken, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PAGES = ["/recommend", "/login"];

function isPublicApi(pathname: string, method: string): boolean {
  if (pathname === "/api/auth/login" && method === "POST") return true;
  if (pathname === "/api/recommendations" && method === "POST") return true;
  if (/^\/api\/recommendations\/[^/]+\/images$/.test(pathname) && method === "POST") {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (isPublicApi(pathname, request.method)) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = session === getSessionToken();

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/inbox", "/login", "/api/:path*"],
};
