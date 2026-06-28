import { NextResponse } from "next/server";
import {
  buildOrderXlsxBuffer,
  formatExportFileSuffix,
  orderExportFilename,
} from "@/lib/export-order-xlsx";
import {
  formatOrderDbError,
  getDistinctExportSuffixes,
  getOrdersByIds,
  markOrdersExported,
} from "@/lib/orders";
import { requireSellerShop } from "@/lib/seller";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { orderIds, exportOrderDate, mode = "final" } = (await request.json()) as {
      orderIds?: string[];
      exportOrderDate?: string;
      mode?: "preview" | "final";
    };
    if (!orderIds?.length) {
      return NextResponse.json(
        { error: "보낼 발주를 선택해 주세요." },
        { status: 400 }
      );
    }
    if (!exportOrderDate?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(exportOrderDate)) {
      return NextResponse.json(
        { error: "발주일(YYYY-MM-DD)을 입력해 주세요." },
        { status: 400 }
      );
    }

    const orders = await getOrdersByIds(shop.id, orderIds);
    if (orders.length === 0) {
      return NextResponse.json(
        { error: "선택한 발주를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (mode === "preview") {
      const notTemp = orders.filter((o) => o.status !== "draft");
      if (notTemp.length > 0) {
        return NextResponse.json(
          {
            error: `임시 발주서 미리보기는 입금 대기 건만 가능합니다. (${notTemp.length}건 제외)`,
          },
          { status: 400 }
        );
      }
    } else {
      const notReady = orders.filter((o) => o.status !== "paid");
      if (notReady.length > 0) {
        return NextResponse.json(
          {
            error: `최종 발주서는 입금 완료 건만 가능합니다. 입금 확인 후 다시 시도해 주세요. (${notReady.length}건)`,
          },
          { status: 400 }
        );
      }
    }

    const dateIso = exportOrderDate.slice(0, 10);
    let fileSuffix = "";
    if (mode === "final") {
      const existing = await getDistinctExportSuffixes(shop.id, dateIso);
      fileSuffix = formatExportFileSuffix(existing.length);
    }

    const buffer = buildOrderXlsxBuffer(shop.name, orders, dateIso);

    if (mode === "final") {
      await markOrdersExported(shop.id, orders.map((o) => o.id), fileSuffix);
    }

    const filename = orderExportFilename(shop.name, dateIso, {
      kind: mode === "preview" ? "preview" : "final",
      suffix: mode === "final" ? fileSuffix : undefined,
    });
    const encoded = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      },
    });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}
