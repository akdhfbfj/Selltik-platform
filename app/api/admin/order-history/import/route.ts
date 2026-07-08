import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  clearImportedOrderBatches,
  deleteClaimImportedOrderBatches,
  deleteInvalidDateImportedOrderBatches,
  getImportedOrderBatchStats,
  importOrderHistoryCsv,
} from "@/lib/import-order-history";
import { parseOrderHistoryCsv } from "@/lib/parse-order-history-csv";
import { formatDbError } from "@/lib/products";

export async function GET(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const fromDate = url.searchParams.get("from")?.trim() || undefined;
    const toDate = url.searchParams.get("to")?.trim() || undefined;
    const seller = url.searchParams.get("seller")?.trim() || undefined;
    const stats = await getImportedOrderBatchStats({ fromDate, toDate, seller });
    return NextResponse.json({ success: true, ...stats });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatDbError(err) || "통계를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

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

    const defaultYearRaw = formData.get("defaultYear");
    const defaultYear =
      typeof defaultYearRaw === "string" && defaultYearRaw.trim()
        ? parseInt(defaultYearRaw, 10)
        : 2026;

    const text = (await file.text()).replace(/^\uFEFF/, "");
    const { lines, claimsSkipped } = parseOrderHistoryCsv(text, defaultYear);
    if (lines.length === 0) {
      return NextResponse.json(
        {
          error:
            claimsSkipped > 0
              ? "클레임만 인식되었거나 유효한 발주 행이 없습니다."
              : "인식된 발주 행이 없습니다. 종합 CSV 형식을 확인해주세요.",
        },
        { status: 400 }
      );
    }

    const result = await importOrderHistoryCsv(lines, file.name);
    const skipNote =
      result.skipped > 0 ? ` (이미 등록된 묶음 ${result.skipped}건 건너뜀)` : "";
    const claimNote =
      claimsSkipped > 0 ? ` 클레임 ${claimsSkipped}줄 제외.` : "";
    const matchNote =
      result.unmatchedLines > 0
        ? ` 상품명 미매칭 ${result.unmatchedLines}줄 — 매입가관리 CSV를 먼저 올리면 판매·마진 집계가 정확해집니다.`
        : "";

    return NextResponse.json({
      success: true,
      ...result,
      claimsSkipped,
      message: `발주 CSV ${result.parsedLines}줄 → ${result.batchCount}개 묶음 중 ${result.imported}건 저장${skipNote}.${claimNote}${matchNote}`,
    });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatDbError(err) || "CSV 가져오기에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const scope = new URL(request.url).searchParams.get("scope");

    if (scope === "claims") {
      const deleted = await deleteClaimImportedOrderBatches();
      return NextResponse.json({
        success: true,
        deleted,
        message: `클레임 발주 묶음 ${deleted}건을 삭제했습니다.`,
      });
    }

    if (scope === "invalid-dates") {
      const deleted = await deleteInvalidDateImportedOrderBatches();
      return NextResponse.json({
        success: true,
        deleted,
        message: `잘못된 발주일(1970-01-01) 묶음 ${deleted}건을 삭제했습니다. CSV를 다시 업로드해주세요.`,
      });
    }

    const deleted = await clearImportedOrderBatches();
    return NextResponse.json({
      success: true,
      deleted,
      message: `과거 발주 집계 ${deleted}건을 삭제했습니다.`,
    });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json(
      { error: formatDbError(err) || "삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
