import { orderExportTitle } from "./export-order-xlsx";
import { calcOrderPricing } from "./order-pricing";
import {
  buildGroupCounts,
  formatOrderDateShort,
  orderToSpreadsheetRow,
  shouldPastelHighlightRow,
} from "./order-spreadsheet-columns";
import type { Order, SellerProductView } from "./types";

export type OrderPriceFields = {
  salePrice: number;
  purchasePrice: number;
  supplyTotal: number;
  celticDeposit: number;
  margin: number;
};

export function findProductForOrder(
  order: Order,
  products: SellerProductView[]
): SellerProductView | null {
  if (order.productId) {
    const byId = products.find((p) => p.id === order.productId);
    if (byId) return byId;
  }
  const name = order.productName.trim();
  return (
    products.find((p) => p.officialName.trim() === name) ??
    products.find((p) => p.smsName.trim() === name) ??
    null
  );
}

export function orderPriceFields(
  order: Order,
  products: SellerProductView[]
): OrderPriceFields {
  const product = findProductForOrder(order, products);
  const pricing = calcOrderPricing(
    product,
    order.quantity,
    order.postalCode,
    order.address,
    order.isRemoteArea
  );
  const celticDeposit = order.celticDepositAmount ?? order.supplyTotal;
  return {
    salePrice: pricing.customerDepositAmount,
    purchasePrice: order.purchasePrice,
    supplyTotal: order.supplyTotal,
    celticDeposit,
    margin: pricing.customerDepositAmount - celticDeposit,
  };
}

export function sumOrderPriceFields(
  orders: Order[],
  products: SellerProductView[]
): OrderPriceFields {
  return orders.reduce(
    (acc, order) => {
      const p = orderPriceFields(order, products);
      return {
        salePrice: acc.salePrice + p.salePrice,
        purchasePrice: acc.purchasePrice + p.purchasePrice,
        supplyTotal: acc.supplyTotal + p.supplyTotal,
        celticDeposit: acc.celticDeposit + p.celticDeposit,
        margin: acc.margin + p.margin,
      };
    },
    {
      salePrice: 0,
      purchasePrice: 0,
      supplyTotal: 0,
      celticDeposit: 0,
      margin: 0,
    }
  );
}

export type SpreadsheetColumnMode = "vendor" | "seller" | "completed";

export function columnModeForSheetKind(
  kind: "temp" | "final" | "done"
): SpreadsheetColumnMode {
  if (kind === "temp") return "seller";
  if (kind === "done") return "completed";
  return "vendor";
}

export const VENDOR_HEADERS = [
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

export const SELLER_HEADERS = [
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
  "판매가",
  "매입가",
  "마진",
] as const;

export const COMPLETED_HEADERS = [
  "발주서",
  "제품명",
  "수량",
  "주문자",
  "수령인",
  "연락처1",
  "연락처2",
  "우편번호",
  "주소",
  "배송메모",
  "판매가",
  "매입가",
  "마진",
] as const;

export type CompletedGroup = {
  key: string;
  title: string;
  orders: Order[];
};

export function groupCompletedOrders(
  orders: Order[],
  shopName: string
): CompletedGroup[] {
  const map = new Map<string, Order[]>();
  for (const o of orders) {
    const suffix = o.exportSuffix ?? "";
    const key = `${o.orderDate}|${suffix}`;
    const list = map.get(key) ?? [];
    list.push(o);
    map.set(key, list);
  }

  return [...map.entries()]
    .map(([key, groupOrders]) => {
      const sorted = [...groupOrders].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt)
      );
      const [orderDate, suffix] = key.split("|");
      return {
        key,
        title: orderExportTitle(shopName, orderDate, suffix || null),
        orders: sorted,
      };
    })
    .sort((a, b) => {
      const dateCmp = b.orders[0].orderDate.localeCompare(a.orders[0].orderDate);
      if (dateCmp !== 0) return dateCmp;
      return (a.orders[0].exportSuffix ?? "").localeCompare(
        b.orders[0].exportSuffix ?? ""
      );
    });
}

export type SpreadsheetBaseRow = ReturnType<typeof orderToSpreadsheetRow>;

export {
  buildGroupCounts,
  formatOrderDateShort,
  orderToSpreadsheetRow,
  shouldPastelHighlightRow,
};
