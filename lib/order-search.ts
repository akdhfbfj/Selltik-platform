import type { Order } from "./types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s/g, "").replace(/-/g, "");
}

export function matchesOrderSearch(order: Order, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;

  const fields = [
    order.productName,
    order.ordererName,
    order.recipientName,
    order.contactPhone,
    order.contactPhone2,
    order.address,
    order.postalCode,
    order.shippingMemo,
  ];

  return fields.some((field) => normalize(field).includes(q));
}
