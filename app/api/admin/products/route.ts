import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAllMasterProducts } from "@/lib/products";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const products = await getAllMasterProducts();
    return NextResponse.json({ products, total: products.length });
  } catch {
    return NextResponse.json(
      { error: "상품 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
