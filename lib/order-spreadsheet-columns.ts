import { orderPersonKey } from "./order-duplicates";
import type { Order } from "./types";

/** yy-mm-dd (실무 양식) — 타임존 영향 없이 ISO 문자열만 사용 */
export function formatOrderDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${y.slice(2)}-${m}-${d}`;
}

/** 실무 발주서 14열 (xlsx·화면 공통) */
export const ORDER_SPREADSHEET_HEADERS = [
  "발주일자",
  "제품명",
  "수량",
  "주문자",
  "수령인",
  "연락처1",
  "연락처2",
  "우편번호",
  "주소",
  "배송메모",
  "매입가",
  "택배비",
  "계",
  "셀틱 입금액",
] as const;

export type OrderSpreadsheetRow = {
  orderDate: string;
  productName: string;
  quantity: number;
  ordererName: string;
  recipientName: string;
  contactPhone: string;
  contactPhone2: string;
  postalCode: string;
  address: string;
  shippingMemo: string;
  purchasePrice: number;
  shippingFee: number | string;
  supplyTotal: number;
  celticDeposit: number;
};

export function buildGroupCounts(orders: Order[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const o of orders) {
    const key = orderPersonKey(o);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** 수량 2+ 또는 동일 수신인 묶음(2건+)일 때 파스텔 행 */
export function shouldPastelHighlightRow(
  order: Pick<
    Order,
    "quantity" | "ordererName" | "recipientName" | "contactPhone"
  >,
  groupCounts: Map<string, number>
): boolean {
  if (order.quantity !== 1) return true;
  return (groupCounts.get(orderPersonKey(order)) ?? 0) > 1;
}

export function orderToSpreadsheetRow(
  order: Order,
  options?: {
    exportOrderDate?: string;
    groupCounts?: Map<string, number>;
  }
): OrderSpreadsheetRow {
  const groupCounts = options?.groupCounts ?? buildGroupCounts([order]);
  const dateIso = options?.exportOrderDate ?? order.orderDate;

  return {
    orderDate: formatOrderDateShort(dateIso),
    productName: order.productName,
    quantity: order.quantity,
    ordererName: order.ordererName,
    recipientName: order.recipientName,
    contactPhone: order.contactPhone,
    contactPhone2: order.contactPhone2,
    postalCode: order.postalCode,
    address: order.address,
    shippingMemo: order.shippingMemo,
    purchasePrice: order.purchasePrice,
    shippingFee: order.shippingFee === 0 ? "-" : order.shippingFee,
    supplyTotal: order.supplyTotal,
    celticDeposit: order.supplyTotal,
  };
}

export function ordersToSpreadsheetRows(
  orders: Order[],
  exportOrderDate?: string
): OrderSpreadsheetRow[] {
  const groupCounts = buildGroupCounts(orders);
  return orders.map((o) =>
    orderToSpreadsheetRow(o, { exportOrderDate, groupCounts })
  );
}
