import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getShopById } from "@/lib/shops";
import { createServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { password } = (await request.json()) as { password?: string };

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "임시 비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const shop = await getShopById(id);
    if (!shop?.authUserId) {
      return NextResponse.json({ error: "셀러를 찾을 수 없습니다." }, { status: 404 });
    }

    const supabase = createServerClient();
    const { error } = await supabase.auth.admin.updateUserById(shop.authUserId, {
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "비밀번호 변경에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, shopId: shop.id, shopName: shop.name });
  } catch {
    return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
  }
}
