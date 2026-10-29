import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  buildSupplyPriceTemplateCsvDownload,
  SUPPLY_TEMPLATE_CSV_FILENAME,
} from "@/lib/supply-template-csv";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  return new NextResponse(buildSupplyPriceTemplateCsvDownload(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(SUPPLY_TEMPLATE_CSV_FILENAME)}`,
    },
  });
}
