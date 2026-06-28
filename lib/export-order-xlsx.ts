import XLSX from "xlsx-js-style";
import {
  ORDER_SPREADSHEET_HEADERS,
  formatOrderDateShort,
  orderToSpreadsheetRow,
  shouldPastelHighlightRow,
} from "./order-spreadsheet-columns";
import type { Order } from "./types";
import { orderPersonKey } from "./order-duplicates";

export { formatOrderDateShort };

const COLS = 14;
const TOTAL_COL = 12; // M열 계
const CELTIC_COL = 13; // N열 셀틱 입금액
const DATA_START_ROW = 3; // 엑셀 4행
const MIN_DATA_ROWS = 30;

const HEADER_FILL = "E0E0E0";
const CELTIC_HEADER_FILL = "FFF9C4";
const CELTIC_TOTAL_FILL = "FFEB3B";

const PASTEL_ROW_FILL = "E8F5E9";

/** 동일 수신인 묶음 — 그룹별 파스텔 */
const GROUP_ROW_COLORS = [
  "E3F2FD",
  "F3E5F5",
  "FFF8E1",
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
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
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

function rowFill(
  order: Order,
  groupCounts: Map<string, number>,
  groupStyleIndex: Map<string, number>
): string | undefined {
  if (!shouldPastelHighlightRow(order, groupCounts)) return undefined;
  const key = orderPersonKey(order);
  const bundled = (groupCounts.get(key) ?? 0) > 1;
  if (bundled) {
    return GROUP_ROW_COLORS[groupStyleIndex.get(key) ?? 0];
  }
  return PASTEL_ROW_FILL;
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

/** 같은 날 n번째 최종 발주서 파일 접미사: "", "A", "B", … */
export function formatExportFileSuffix(priorExportCount: number): string {
  if (priorExportCount <= 0) return "";
  return String.fromCharCode(64 + priorExportCount);
}

function emptyRowValues(): CellValue[] {
  return Array.from({ length: COLS }, (_, i) =>
    i === TOTAL_COL || i === CELTIC_COL ? 0 : ""
  );
}

function spreadsheetRowValues(
  o: Order,
  exportOrderDate: string,
  groupCounts: Map<string, number>
): CellValue[] {
  const row = orderToSpreadsheetRow(o, { exportOrderDate, groupCounts });
  return [
    row.orderDate,
    row.productName,
    row.quantity,
    row.ordererName,
    row.recipientName,
    row.contactPhone,
    row.contactPhone2,
    row.postalCode,
    row.address,
    row.shippingMemo,
    row.purchasePrice,
    row.shippingFee,
    row.supplyTotal,
    "",
  ];
}

export function buildOrderSheetRows(
  shopName: string,
  orders: Order[],
  exportOrderDate: string
): CellValue[][] {
  const { groupCounts } = buildGroupMeta(orders);
  const unitRow = Array.from({ length: COLS }, () => "");
  unitRow[0] = shopName;
  unitRow[COLS - 1] = "(단위:원)";

  const rows: CellValue[][] = [
    ["발주서"],
    unitRow,
    [...ORDER_SPREADSHEET_HEADERS],
  ];

  for (const o of orders) {
    rows.push(spreadsheetRowValues(o, exportOrderDate, groupCounts));
  }

  if (orders.length > 0) {
    rows[3][CELTIC_COL] = sumCelticDeposit(orders);
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
  const celticTotal = sumCelticDeposit(orders);

  ws[cellRef(0, 0)] = styledCell("발주서", { bold: true, align: "center" });
  ws[cellRef(1, 0)] = styledCell(shopName, { bold: true });
  ws[cellRef(1, COLS - 1)] = styledCell("(단위:원)", { align: "right" });

  ORDER_SPREADSHEET_HEADERS.forEach((h, c) => {
    ws[cellRef(2, c)] = styledCell(h, {
      bold: true,
      align: "center",
      fill: h === "셀틱 입금액" ? CELTIC_HEADER_FILL : HEADER_FILL,
    });
  });

  if (orders.length > 0) {
    ws[cellRef(DATA_START_ROW, CELTIC_COL)] = styledCell(celticTotal, {
      bold: true,
      align: "right",
      fill: CELTIC_TOTAL_FILL,
      numFmt: "#,##0",
    });
  }

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const fill = rowFill(o, groupCounts, groupStyleIndex);
    const values = spreadsheetRowValues(o, exportOrderDate, groupCounts);

    values.forEach((val, c) => {
      if (c === CELTIC_COL) return;
      ws[cellRef(DATA_START_ROW + i, c)] = styledCell(val, {
        fill,
        numFmt: c === 10 || c === 11 || c === 12 ? "#,##0" : undefined,
        align:
          c === 2 || (c >= 10 && c <= 12)
            ? "right"
            : c === 0
              ? "center"
              : "left",
      });
    });
  }

  for (let i = orders.length; i < MIN_DATA_ROWS; i++) {
    emptyRowValues().forEach((val, c) => {
      if (c === CELTIC_COL) return;
      ws[cellRef(DATA_START_ROW + i, c)] = styledCell(val, {
        numFmt: c === TOTAL_COL ? "#,##0" : undefined,
        align:
          c === 2 || (c >= 10 && c <= 12)
            ? "right"
            : c === 0
              ? "center"
              : "left",
      });
    });
  }

  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }];
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
    e: { r: DATA_START_ROW + MIN_DATA_ROWS - 1, c: CELTIC_COL },
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
export function orderExportTitle(
  shopName: string,
  orderDateIso: string,
  suffix?: string | null
): string {
  const [y, m, d] = orderDateIso.slice(0, 10).split("-");
  const safe = shopName.replace(/[\\/:*?"<>|]/g, "_").trim() || "셀러";
  const letter = suffix ?? "";
  return `[발주] ${Number(y) % 100}.${Number(m)}.${Number(d)}. 발주서(${safe})${letter}`;
}

export function orderExportFilename(
  shopName: string,
  orderDateIso: string,
  options?: {
    kind?: "final" | "preview";
    suffix?: string;
  }
): string {
  const prefix = options?.kind === "preview" ? "[임시발주]" : "[발주]";
  const base = orderExportTitle(
    shopName,
    orderDateIso,
    options?.suffix ?? ""
  ).replace(/^\[발주\]/, prefix);
  return `${base}.xlsx`;
}
