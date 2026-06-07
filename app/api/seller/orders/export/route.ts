import { NextResponse } from "next/server";
import {
  buildOrderXlsxBuffer,
  orderExportFilename,
} from "@/lib/export-order-xlsx";
import {
  formatOrderDbError,
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
    const { orderIds } = (await request.json()) as { orderIds?: string[] };
    if (!orderIds?.length) {
      return NextResponse.json(
        { error: "보낼 발주를 선택해 주세요." },
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

    const buffer = buildOrderXlsxBuffer(shop.name, orders);
    await markOrdersExported(shop.id, orders.map((o) => o.id));

    const filename = orderExportFilename(shop.name);
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
