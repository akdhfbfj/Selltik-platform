import { NextResponse } from "next/server";
import { findDuplicateOrders } from "@/lib/order-duplicates";
import { buildOrderDraftBundle, formatOrderDbError, getOrdersByShop } from "@/lib/orders";
import { parseOrderSmsWithLearning } from "@/lib/sms-parse-learn";
import {
  collectImportWarnings,
  SMS_IMPORT_BATCH_MAX,
  type SmsImportBatchItem,
  type SmsImportParseResult,
} from "@/lib/sms-import-batch";
import { requireSellerShop } from "@/lib/seller";

export async function POST(request: Request) {
  const shop = await requireSellerShop();
  if (!shop) {
    return NextResponse.json({ error: "셀러 로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const { items } = (await request.json()) as { items?: SmsImportBatchItem[] };
    if (!items?.length) {
      return NextResponse.json(
        { error: "분석할 문자를 선택해 주세요." },
        { status: 400 }
      );
    }
    if (items.length > SMS_IMPORT_BATCH_MAX) {
      return NextResponse.json(
        { error: `한 번에 최대 ${SMS_IMPORT_BATCH_MAX}건까지 분석할 수 있습니다.` },
        { status: 400 }
      );
    }

    const existingOrders = await getOrdersByShop(shop.id);
    const results: SmsImportParseResult[] = [];

    for (const item of items) {
      if (!item.body?.trim()) {
        results.push({
          sourceId: item.id,
          ok: false,
          error: "본문이 비어 있습니다.",
          duplicateOrderIds: [],
          warnings: [],
        });
        continue;
      }

      try {
        const parsed = await parseOrderSmsWithLearning(item.body, shop.id);
        const draftBundle = await buildOrderDraftBundle(
          shop.id,
          parsed,
          item.body,
          { customerOrderDate: item.dateIso }
        );

        const duplicates = findDuplicateOrders(existingOrders, {
          orderDate: draftBundle.orderDate,
          ordererName: draftBundle.ordererName,
          recipientName: draftBundle.recipientName,
          contactPhone: draftBundle.contactPhone,
        });

        const duplicateOrderIds = duplicates.map((o) => o.id);
        const warnings = collectImportWarnings(
          draftBundle,
          duplicateOrderIds.length
        );

        results.push({
          sourceId: item.id,
          ok: true,
          draftBundle,
          duplicateOrderIds,
          warnings,
        });
      } catch (e) {
        const err = e as { message?: string };
        results.push({
          sourceId: item.id,
          ok: false,
          error: formatOrderDbError(err),
          duplicateOrderIds: [],
          warnings: [],
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;
    const dupCount = results.filter((r) => r.duplicateOrderIds.length > 0).length;

    return NextResponse.json({
      results,
      summary: { total: results.length, okCount, failCount, dupCount },
    });
  } catch (e) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: formatOrderDbError(err) },
      { status: 500 }
    );
  }
}
