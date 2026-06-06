import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createShopWithAuthUser, getAllShops } from "@/lib/shops";
import type { ShopInput } from "@/lib/types";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const shops = await getAllShops();
    return NextResponse.json({ shops });
  } catch {
    return NextResponse.json(
      { error: "셀러 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ShopInput;
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "쇼핑몰 이름은 필수입니다." }, { status: 400 });
    }
    if (!body.contactEmail?.trim()) {
      return NextResponse.json({ error: "이메일은 필수입니다." }, { status: 400 });
    }
    if (!body.password || body.password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: body.contactEmail.trim().toLowerCase(),
        password: body.password,
        email_confirm: true,
      });

    if (authError) {
      const msg =
        authError.message.includes("already") ||
        authError.message.includes("registered")
          ? "이미 사용 중인 이메일입니다."
          : "계정 생성에 실패했습니다.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const shop = await createShopWithAuthUser(body, authData.user.id);
    return NextResponse.json(shop, { status: 201 });
  } catch {
    return NextResponse.json({ error: "셀러 등록에 실패했습니다." }, { status: 500 });
  }
}
