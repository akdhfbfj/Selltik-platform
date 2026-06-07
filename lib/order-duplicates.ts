import type { Order } from "./types";

export type OrderPersonFields = Pick<
  Order,
  "orderDate" | "ordererName" | "recipientName" | "contactPhone"
>;

function normalize(s: string): string {
  return s.replace(/\s/g, "").replace(/-/g, "").toLowerCase();
}

/** 같은 주문자·수령인·연락처 묶음 키 */
export function orderPersonKey(
  order: Pick<Order, "ordererName" | "recipientName" | "contactPhone">
): string {
  return [
    normalize(order.ordererName),
    normalize(order.recipientName),
    normalize(order.contactPhone),
  ].join("|");
}

/** 발주일 + 동일 수신인 기준 중복 후보 */
export function findDuplicateOrders(
  orders: Order[],
  candidate: OrderPersonFields,
  excludeId?: string
): Order[] {
  const key = orderPersonKey(candidate);
  return orders.filter(
    (o) =>
      o.orderDate === candidate.orderDate &&
      orderPersonKey(o) === key &&
      o.id !== excludeId
  );
}

export function isDuplicateOrder(
  orders: Order[],
  candidate: OrderPersonFields,
  excludeId?: string
): boolean {
  return findDuplicateOrders(orders, candidate, excludeId).length > 0;
}
