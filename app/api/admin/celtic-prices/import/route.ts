import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseCelticPriceCsv } from "@/lib/parse-celtic-price-csv";
import { formatDbError, importCelticPriceProducts } from "@/lib/products";

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
    const items = parseCelticPriceCsv(text);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "인식된 상품이 없습니다. 매입가관리 CSV 형식을 확인해주세요." },
        { status: 400 }
      );
    }

    const result = await importCelticPriceProducts(items);
    const dupNote =
      result.duplicates > 0
        ? ` (CSV 중복 상품명 ${result.duplicates}건은 마지막 행으로 통합)`
        : "";
    const changeNote =
      result.changed > 0
        ? ` 변경·신규 ${result.changed}건 — 셀러 확인 요청이 전달될 수 있습니다.`
        : " 변경된 상품 없음.";

    return NextResponse.json({
      success: true,
      ...result,
      message: `매입가관리 CSV ${result.parsed}행 중 ${result.imported}개 상품(셀틱·셀러 원가)이 반영되었습니다.${dupNote}${changeNote}`,
    });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatDbError(err) || "CSV 가져오기에 실패했습니다." },
      { status: 500 }
    );
  }
}
