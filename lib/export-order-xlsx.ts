import * as XLSX from "xlsx";
import type { Order } from "./types";

const COLS = 14;
const DATA_START_ROW = 3;
const MIN_DATA_ROWS = 30;

/** Excel 날짜 시리얼 (발주일자 열) */
export function toExcelDate(isoDate: string): number {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  const epoch = new Date(1899, 11, 30);
  return Math.round((d.getTime() - epoch.getTime()) / 86_400_000);
}

export function sumCelticDeposit(orders: Order[]): number {
  return orders.reduce(
    (sum, o) => sum + (o.celticDepositAmount ?? o.supplyTotal),
    0
  );
}

function emptyRow(): (string | number)[] {
  return Array.from({ length: COLS }, (_, i) => (i === 12 ? 0 : ""));
}

export function buildOrderSheetRows(
  shopName: string,
  orders: Order[]
): (string | number)[][] {
  const totalCeltic = sumCelticDeposit(orders);

  const headerPad = (label: string, value = ""): (string | number)[] => {
    const row = Array(COLS).fill("") as (string | number)[];
    row[0] = label;
    if (value) row[1] = value;
    row[12] = "(단위,원)";
    return row;
  };

  const rows: (string | number)[][] = [
    (() => {
      const r = Array(COLS).fill("") as (string | number)[];
      r[0] = "발  주  서 (셀러→셀틱)";
      return r;
    })(),
    headerPad("업체명", shopName),
    [
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
    ],
  ];

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    rows.push([
      toExcelDate(o.orderDate),
      o.productName,
      o.quantity,
      o.ordererName,
      o.recipientName,
      o.contactPhone,
      o.contactPhone2,
      o.postalCode,
      o.address,
      o.shippingMemo,
      o.purchasePrice,
      o.shippingFee,
      o.supplyTotal,
      i === 0 ? totalCeltic : "",
    ]);
  }

  const padCount = Math.max(0, MIN_DATA_ROWS - orders.length);
  for (let i = 0; i < padCount; i++) {
    rows.push(emptyRow());
  }

  return rows;
}

export function buildOrderWorkbook(
  shopName: string,
  orders: Order[]
): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(buildOrderSheetRows(shopName, orders));

  ws["!cols"] = [
    { wch: 10 },
    { wch: 42 },
    { wch: 6 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
    { wch: 48 },
    { wch: 14 },
    { wch: 10 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "발주서");
  return wb;
}

export function buildOrderXlsxBuffer(
  shopName: string,
  orders: Order[]
): Buffer {
  const wb = buildOrderWorkbook(shopName, orders);
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer
  );
}

export function orderExportFilename(shopName: string, date = new Date()): string {
  const y = date.getFullYear() % 100;
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const safe = shopName.replace(/[\\/:*?"<>|]/g, "_").trim() || "셀러";
  return `[발주] ${y}.${m}.${d}. 발주서(${safe}).xlsx`;
}
