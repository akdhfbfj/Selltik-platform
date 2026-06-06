import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseSupplyCsv } from "@/lib/parse-supply-csv";
import { formatDbError, importSupplyProducts } from "@/lib/products";

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "CSV 파일을 선택해주세요." }, { status: 400 });
    }

    const text = (await file.text()).replace(/^\uFEFF/, "");
    const items = parseSupplyCsv(text);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "인식된 상품이 없습니다. CSV 형식을 확인해주세요." },
        { status: 400 }
      );
    }

    const result = await importSupplyProducts(items);
    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.imported}개 상품이 반영되었습니다.`,
    });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatDbError(err) || "CSV 가져오기에 실패했습니다." },
      { status: 500 }
    );
  }
}
