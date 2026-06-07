import XLSX from "xlsx-js-style";
import type { Order } from "./types";
import { orderPersonKey } from "./order-duplicates";

const COLS = 13;
const TOTAL_COL = 13; // N열
const DATA_START_ROW = 3;
const MIN_DATA_ROWS = 30;

/** 동일 주문자·수령인·연락처1 묶음 — A~M 행 전체 파스텔 */
const GROUP_ROW_COLORS = [
  "E3F2FD",
  "F3E5F5",
  "E8F5E9",
  "FFF8E1",
  "FCE4EC",
  "E0F7FA",
  "F1F8E9",
  "EDE7F6",
] as const;

type CellValue = string | number;

function cellRef(row: number, col: number): string {
  return XLSX.utils.encode_cell({ r: row, c: col });
}

function baseBorder() {
  return {
    top: { style: "thin", color: { rgb: "CCCCCC" } },
    bottom: { style: "thin", color: { rgb: "CCCCCC" } },
    left: { style: "thin", color: { rgb: "CCCCCC" } },
    right: { style: "thin", color: { rgb: "CCCCCC" } },
  };
}

function styledCell(
  value: CellValue,
  opts?: {
    fill?: string;
    bold?: boolean;
    align?: "left" | "center" | "right";
    numFmt?: string;
  }
) {
  const align = opts?.align ?? (typeof value === "number" ? "right" : "left");
  return {
    v: value,
    t: typeof value === "number" ? "n" : "s",
    s: {
      border: baseBorder(),
      alignment: { horizontal: align, vertical: "center", wrapText: true },
      font: opts?.bold ? { bold: true } : undefined,
      fill: opts?.fill ? { fgColor: { rgb: opts.fill } } : undefined,
      numFmt: opts?.numFmt,
    },
  };
}

/** yy-mm-dd (실무 양식) — 타임존 영향 없이 ISO 문자열만 사용 */
export function formatOrderDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${y.slice(2)}-${m}-${d}`;
}

/** @deprecated 엑셀 시리얼 — 테스트 호환용 */
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

export function sumSupplyTotal(orders: Order[]): number {
  return orders.reduce((sum, o) => sum + o.supplyTotal, 0);
}

function emptyRowValues(): CellValue[] {
  return Array.from({ length: COLS }, (_, i) => (i === 12 ? 0 : ""));
}

function buildGroupMeta(orders: Order[]) {
  const groupCounts = new Map<string, number>();
  const groupStyleIndex = new Map<string, number>();
  let styleCursor = 0;

  for (const o of orders) {
    const key = orderPersonKey(o);
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    if (!groupStyleIndex.has(key)) {
      groupStyleIndex.set(key, styleCursor % GROUP_ROW_COLORS.length);
      styleCursor++;
    }
  }

  return { groupCounts, groupStyleIndex };
}

function orderRowValues(
  o: Order,
  exportOrderDate: string,
  bundled: boolean
): CellValue[] {
  const memo =
    bundled && !o.shippingMemo.trim()
      ? "묶음배송"
      : bundled
        ? o.shippingMemo.trim() || "묶음배송"
        : o.shippingMemo;

  return [
    formatOrderDateShort(exportOrderDate),
    o.productName,
    o.quantity,
    o.ordererName,
    o.recipientName,
    o.contactPhone,
    o.contactPhone2,
    o.postalCode,
    o.address,
    memo,
    o.purchasePrice,
    o.shippingFee === 0 ? "-" : o.shippingFee,
    o.supplyTotal,
  ];
}

export function buildOrderSheetRows(
  shopName: string,
  orders: Order[],
  exportOrderDate: string
): CellValue[][] {
  const { groupCounts } = buildGroupMeta(orders);

  const rows: CellValue[][] = [
    ["발주서"],
    [shopName, "", "", "", "", "", "", "", "", "", "", "", "(단위:원)"],
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
    ],
  ];

  for (const o of orders) {
    const bundled = (groupCounts.get(orderPersonKey(o)) ?? 0) > 1;
    rows.push(orderRowValues(o, exportOrderDate, bundled));
  }

  const padCount = Math.max(0, MIN_DATA_ROWS - orders.length);
  for (let i = 0; i < padCount; i++) {
    rows.push(emptyRowValues());
  }

  return rows;
}

export function buildOrderWorkbook(
  shopName: string,
  orders: Order[],
  exportOrderDate: string
): XLSX.WorkBook {
  const rows = buildOrderSheetRows(shopName, orders, exportOrderDate);
  const { groupCounts, groupStyleIndex } = buildGroupMeta(orders);
  const ws: XLSX.WorkSheet = {};

  ws[cellRef(0, 0)] = styledCell("발주서", { bold: true, align: "center" });
  ws[cellRef(1, 0)] = styledCell(shopName, { bold: true });
  ws[cellRef(1, 12)] = styledCell("(단위:원)", { align: "right" });

  rows[2].forEach((h, c) => {
    ws[cellRef(2, c)] = styledCell(h as string, { bold: true, align: "center" });
  });

  const mColumnTotal = sumSupplyTotal(orders);
  ws[cellRef(3, TOTAL_COL)] = styledCell(mColumnTotal, {
    bold: true,
    align: "right",
    numFmt: "#,##0",
  });

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const key = orderPersonKey(o);
    const bundled = (groupCounts.get(key) ?? 0) > 1;
    const rowFill = bundled
      ? GROUP_ROW_COLORS[groupStyleIndex.get(key) ?? 0]
      : undefined;
    const values = orderRowValues(o, exportOrderDate, bundled);

    values.forEach((val, c) => {
      ws[cellRef(DATA_START_ROW + i, c)] = styledCell(val, {
        fill: rowFill,
        numFmt: c === 10 || c === 11 || c === 12 ? "#,##0" : undefined,
        align: c === 2 || c >= 10 ? "right" : "left",
      });
    });
  }

  for (let i = orders.length; i < MIN_DATA_ROWS; i++) {
    emptyRowValues().forEach((val, c) => {
      ws[cellRef(DATA_START_ROW + i, c)] = styledCell(val, {
        numFmt: c === 12 ? "#,##0" : undefined,
        align: c === 2 || c >= 10 ? "right" : "left",
      });
    });
  }

  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }];
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
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: DATA_START_ROW + MIN_DATA_ROWS - 1, c: TOTAL_COL },
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "발주서");
  return wb;
}

export function buildOrderXlsxBuffer(
  shopName: string,
  orders: Order[],
  exportOrderDate: string
): Buffer {
  const wb = buildOrderWorkbook(shopName, orders, exportOrderDate);
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer
  );
}

/** 파일명 — ISO 날짜 문자열 기준 (타임존 오류 방지) */
export function orderExportFilename(
  shopName: string,
  orderDateIso: string
): string {
  const [y, m, d] = orderDateIso.slice(0, 10).split("-");
  const safe = shopName.replace(/[\\/:*?"<>|]/g, "_").trim() || "셀러";
  return `[발주] ${Number(y) % 100}.${Number(m)}.${Number(d)}. 발주서(${safe}).xlsx`;
}
