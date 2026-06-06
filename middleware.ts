import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionToken, SESSION_COOKIE } from "@/lib/auth";

const ADMIN_PAGES = ["/", "/inbox", "/admin"];
const PUBLIC_PAGES = ["/recommend", "/login", "/seller/login"];

function isAdminPage(pathname: string): boolean {
  return ADMIN_PAGES.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`))
  );
}

function isSellerPage(pathname: string): boolean {
  return pathname === "/seller" || pathname.startsWith("/seller/");
}

function isPublicApi(pathname: string, method: string): boolean {
  if (pathname === "/api/auth/login" && method === "POST") return true;
  if (pathname === "/api/recommendations" && method === "POST") return true;
  if (/^\/api\/recommendations\/[^/]+\/images$/.test(pathname) && method === "POST") {
    return true;
  }
  return false;
}

function isSellerApi(pathname: string): boolean {
  return pathname.startsWith("/api/seller/");
}

function isAdminApi(pathname: string): boolean {
  return pathname.startsWith("/api/admin/");
}

function checkAdminPin(request: NextRequest): boolean {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  return session === getSessionToken();
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let sellerUser: { id: string } | null = null;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    sellerUser = user;
  }

  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return response;
  }

  if (isPublicApi(pathname, method)) {
    return response;
  }

  if (isSellerPage(pathname) || isSellerApi(pathname)) {
    if (pathname === "/seller/login") {
      return response;
    }
    if (!sellerUser) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
      }
      const loginUrl = new URL("/seller/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  if (isAdminPage(pathname) || isAdminApi(pathname) || pathname.startsWith("/api/")) {
    if (!checkAdminPin(request)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/inbox",
    "/login",
    "/admin/:path*",
    "/seller/:path*",
    "/api/:path*",
  ],
};
