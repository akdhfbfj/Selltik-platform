"use client";

import {
  COMPLETED_HEADERS,
  COMPLETED_SUMMARY_COLSPAN,
  SELLER_HEADERS,
  VENDOR_HEADERS,
  buildGroupCounts,
  columnModeForSheetKind,
  groupCompletedOrders,
  orderPriceFields,
  orderToSpreadsheetRow,
  shouldPastelHighlightRow,
  shouldShowExportGroupSummaries,
  sumOrderPriceFields,
  type CompletedGroup,
  type SpreadsheetColumnMode,
} from "@/lib/order-spreadsheet-display";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { Order, SellerProductView } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import { useEffect, useState, type ReactNode } from "react";

function ShippingFeeCell({
  order,
  saving,
  onChange,
}: {
  order: Order;
  saving: boolean;
  onChange: (order: Order, shippingFee: number) => void;
}) {
  const [value, setValue] = useState(String(order.shippingFee || ""));

  useEffect(() => {
    setValue(String(order.shippingFee || ""));
  }, [order.shippingFee]);

  const commit = () => {
    const next = Math.max(0, parseInt(value.replace(/\D/g, ""), 10) || 0);
    setValue(String(next));
    if (next !== order.shippingFee) onChange(order, next);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      className="w-full min-w-0 rounded border border-slate-200 bg-white px-0.5 py-0 text-right text-[10px] tabular-nums focus:border-blue-400 focus:outline-none"
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      disabled={saving}
      title="택배비 수정"
    />
  );
}

interface Props {
  shopName: string;
  orders: Order[];
  products?: SellerProductView[];
  displayOrderDate?: string;
  sheetKind?: "temp" | "final" | "done" | "all";
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  onRowClick?: (order: Order) => void;
  onMarkPaid?: (order: Order) => void;
  markingPaidId?: string | null;
  savingShippingId?: string | null;
  onShippingFeeChange?: (order: Order, shippingFee: number) => void;
  renderRowActions?: (order: Order) => ReactNode;
  emptyMessage?: string;
}

const VENDOR_COMPACT: Record<string, string> = {
  발주일자: "일자",
  연락처1: "연1",
  연락처2: "연2",
  우편번호: "우편",
  배송메모: "메모",
  매입가: "매입",
  택배비: "택배",
  "셀틱 입금액": "셀틱",
};

const COLUMN_WIDTHS: Record<
  SpreadsheetColumnMode,
  Partial<Record<string, string>>
> = {
  seller: {
    발주일자: "w-[5%]",
    제품명: "w-[19%]",
    수량: "w-[3%]",
    주문자: "w-[5%]",
    수령인: "w-[5%]",
    연락처1: "w-[7%]",
    연락처2: "w-[4%]",
    우편번호: "w-[5%]",
    주소: "w-[11%]",
    배송메모: "w-[5%]",
    판매가: "w-[6%]",
    매입가: "w-[6%]",
    마진: "w-[6%]",
  },
  completed: {
    제품명: "w-[22%]",
    수량: "w-[3%]",
    주문자: "w-[5%]",
    수령인: "w-[5%]",
    연락처1: "w-[7%]",
    연락처2: "w-[4%]",
    우편번호: "w-[5%]",
    주소: "w-[11%]",
    배송메모: "w-[5%]",
    판매가: "w-[6%]",
    매입가: "w-[6%]",
    마진: "w-[6%]",
  },
  vendor: {
    발주일자: "w-[5%]",
    제품명: "w-[14%]",
    수량: "w-[3%]",
    주문자: "w-[5%]",
    수령인: "w-[5%]",
    연락처1: "w-[7%]",
    연락처2: "w-[4%]",
    우편번호: "w-[5%]",
    주소: "w-[10%]",
    배송메모: "w-[5%]",
    매입가: "w-[5%]",
    택배비: "w-[4%]",
    계: "w-[5%]",
    "셀틱 입금액": "w-[6%]",
  },
};

function sheetTitle(kind: Props["sheetKind"]): string {
  if (kind === "temp") return "임시 발주서";
  if (kind === "done") return "발주 완료";
  if (kind === "all") return "전체 발주";
  return "최종 발주서";
}

function formatNum(v: number): string {
  return v.toLocaleString("ko-KR");
}

function StatusCell({
  order,
  onMarkPaid,
  markingPaidId,
}: {
  order: Order;
  onMarkPaid?: (order: Order) => void;
  markingPaidId?: string | null;
}) {
  if (order.status === "draft" && onMarkPaid) {
    const loading = markingPaidId === order.id;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMarkPaid(order);
        }}
        disabled={loading}
        className="rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "…" : "입금 확인"}
      </button>
    );
  }

  const label =
    order.status === "paid"
      ? "입금 완료"
      : ORDER_STATUS_LABELS[order.status];

  return (
    <span
      className={`text-[9px] font-medium ${
        order.status === "paid"
          ? "text-emerald-700"
          : order.status === "exported"
            ? "text-slate-500"
            : "text-amber-700"
      }`}
    >
      {label}
    </span>
  );
}

function getHeaders(mode: SpreadsheetColumnMode): readonly string[] {
  if (mode === "seller") return SELLER_HEADERS;
  if (mode === "completed") return COMPLETED_HEADERS;
  return VENDOR_HEADERS;
}

export default function OrderSpreadsheetTable({
  shopName,
  orders,
  products = [],
  displayOrderDate,
  sheetKind = "final",
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onRowClick,
  onMarkPaid,
  markingPaidId,
  savingShippingId,
  onShippingFeeChange,
  renderRowActions,
  emptyMessage = "표시할 발주가 없습니다.",
}: Props) {
  const columnMode = columnModeForSheetKind(sheetKind);
  const headers = getHeaders(columnMode);
  const groupCounts = buildGroupCounts(orders);
  const priceTotals = sumOrderPriceFields(orders, products);
  const celticTotal = orders.reduce((sum, o) => sum + o.supplyTotal, 0);
  const supplyTotal = orders.reduce((sum, o) => sum + o.supplyTotal, 0);

  const showSelect = Boolean(selectedIds && onToggleSelect);
  const selectedOrdersList =
    showSelect && selectedIds && selectedIds.size > 0
      ? orders.filter((o) => selectedIds.has(o.id))
      : [];
  const headerTotals =
    columnMode === "seller" && selectedOrdersList.length > 0
      ? sumOrderPriceFields(selectedOrdersList, products)
      : priceTotals;
  const headerSummaryLabel =
    columnMode === "seller" && selectedOrdersList.length > 0
      ? `선택 ${selectedOrdersList.length}건`
      : null;

  const allSelected =
    showSelect &&
    orders.length > 0 &&
    orders.every((o) => selectedIds!.has(o.id));

  if (orders.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">{emptyMessage}</p>
    );
  }

  const renderVendorCell = (
    order: Order,
    header: string,
    row: ReturnType<typeof orderToSpreadsheetRow>
  ) => {
    switch (header) {
      case "발주일자":
        return row.orderDate;
      case "제품명":
        return row.productName;
      case "수량":
        return row.quantity;
      case "주문자":
        return row.ordererName;
      case "수령인":
        return row.recipientName;
      case "연락처1":
        return row.contactPhone;
      case "연락처2":
        return row.contactPhone2;
      case "우편번호":
        return row.postalCode;
      case "주소":
        return row.address;
      case "배송메모":
        return row.shippingMemo;
      case "매입가":
        return formatNum(row.purchasePrice);
      case "택배비":
        return typeof row.shippingFee === "number"
          ? formatNum(row.shippingFee)
          : row.shippingFee;
      case "계":
        return formatNum(row.supplyTotal);
      case "셀틱 입금액":
        return formatNum(row.celticDeposit);
      default:
        return "";
    }
  };

  const renderSellerCell = (
    order: Order,
    header: string,
    row: ReturnType<typeof orderToSpreadsheetRow>
  ) => {
    const price = orderPriceFields(order, products);
    switch (header) {
      case "발주일자":
        return row.orderDate;
      case "제품명":
        return row.productName;
      case "수량":
        return row.quantity;
      case "주문자":
        return row.ordererName;
      case "수령인":
        return row.recipientName;
      case "연락처1":
        return row.contactPhone;
      case "연락처2":
        return row.contactPhone2;
      case "우편번호":
        return row.postalCode;
      case "주소":
        return row.address;
      case "배송메모":
        return row.shippingMemo;
      case "판매가":
        return formatNum(price.salePrice);
      case "매입가":
        return formatNum(price.purchasePrice);
      case "마진":
        return formatNum(price.margin);
      default:
        return "";
    }
  };

  const renderCompletedDataCell = (
    order: Order,
    header: string,
    row: ReturnType<typeof orderToSpreadsheetRow>
  ) => {
    const price = orderPriceFields(order, products);
    switch (header) {
      case "제품명":
        return row.productName;
      case "수량":
        return row.quantity;
      case "주문자":
        return row.ordererName;
      case "수령인":
        return row.recipientName;
      case "연락처1":
        return row.contactPhone;
      case "연락처2":
        return row.contactPhone2;
      case "우편번호":
        return row.postalCode;
      case "주소":
        return row.address;
      case "배송메모":
        return row.shippingMemo;
      case "판매가":
        return formatNum(price.salePrice);
      case "매입가":
        return formatNum(price.supplyTotal);
      case "마진":
        return formatNum(price.margin);
      default:
        return "";
    }
  };

  const isNumericHeader = (header: string) =>
    ["매입가", "택배비", "계", "셀틱 입금액", "판매가", "마진", "수량"].includes(
      header
    );

  const cellClass = (header: string, extra?: string) => {
    const base = "border border-slate-300 px-0.5 py-0.5 align-middle";
    const align =
      header === "제품명"
        ? "break-words text-left leading-snug"
        : header === "주소"
          ? "truncate text-left"
          : isNumericHeader(header)
            ? "text-right tabular-nums"
            : "truncate text-center";
    const highlight =
      header === "셀틱 입금액"
        ? "bg-yellow-50"
        : header === "마진"
          ? "text-blue-800"
          : "";
    return `${base} ${align} ${highlight} ${extra ?? ""} ${onRowClick ? "cursor-pointer" : ""}`;
  };

  const renderDataRow = (order: Order) => {
    const row = orderToSpreadsheetRow(order, {
      exportOrderDate: displayOrderDate,
      groupCounts,
    });
    const selected = selectedIds?.has(order.id);
    const pastel = shouldPastelHighlightRow(order, groupCounts);

    return (
      <tr
        key={order.id}
        className={`${
          selected ? "bg-blue-50/40" : pastel ? "bg-green-50" : "bg-white"
        } hover:bg-slate-50/80`}
      >
        {showSelect && (
          <td className="border border-slate-300 px-0.5 py-0.5 text-center">
            <input
              type="checkbox"
              className="h-3 w-3 rounded border-slate-400"
              checked={selected}
              onChange={() => onToggleSelect?.(order.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </td>
        )}
        {showStatus && (
          <td className="border border-slate-300 px-0.5 py-0.5 text-center align-middle">
            <StatusCell
              order={order}
              onMarkPaid={onMarkPaid}
              markingPaidId={markingPaidId}
            />
          </td>
        )}
        {headers.map((header) => {
          const isEditableShipping =
            columnMode === "vendor" &&
            header === "택배비" &&
            onShippingFeeChange;

          return (
            <td
              key={header}
              title={
                header === "제품명" || header === "주소"
                  ? String(
                      columnMode === "vendor"
                        ? renderVendorCell(order, header, row)
                        : columnMode === "seller"
                          ? renderSellerCell(order, header, row)
                          : renderCompletedDataCell(order, header, row)
                    )
                  : undefined
              }
              className={cellClass(
                header,
                isEditableShipping ? "p-0" : undefined
              )}
              onClick={
                isEditableShipping ? undefined : () => onRowClick?.(order)
              }
            >
              {isEditableShipping ? (
                <ShippingFeeCell
                  order={order}
                  saving={savingShippingId === order.id}
                  onChange={onShippingFeeChange}
                />
              ) : columnMode === "vendor" ? (
                renderVendorCell(order, header, row)
              ) : columnMode === "seller" ? (
                renderSellerCell(order, header, row)
              ) : (
                renderCompletedDataCell(order, header, row)
              )}
            </td>
          );
        })}
        {renderRowActions && (
          <td className="border border-slate-300 px-0.5 py-0.5 text-center">
            {renderRowActions(order)}
          </td>
        )}
      </tr>
    );
  };

  const showStatus = true;
  const showGroupSummaries = shouldShowExportGroupSummaries(sheetKind);
  const exportedOrders = orders.filter((o) => o.status === "exported");
  const nonExportedOrders = orders.filter((o) => o.status !== "exported");
  const completedGroups =
    columnMode === "completed"
      ? groupCompletedOrders(orders, shopName)
      : showGroupSummaries
        ? groupCompletedOrders(exportedOrders, shopName)
        : [];

  const renderGroupSummaryRow = (
    group: CompletedGroup,
    mode: "completed" | "vendor"
  ) => {
    const totals = sumOrderPriceFields(group.orders, products);
    const label = `${group.title} · 합계 ${group.orders.length}건`;

    if (mode === "completed") {
      return (
        <tr
          key={`summary-${group.key}`}
          className="bg-amber-50/80 font-semibold text-slate-800"
        >
          {showSelect && <td className="border border-slate-300" />}
          {showStatus && <td className="border border-slate-300" />}
          <td
            colSpan={COMPLETED_SUMMARY_COLSPAN}
            className="border border-slate-300 px-1 py-1 text-left text-[9px] leading-snug"
            title={group.title}
          >
            {label}
          </td>
          <td className="border border-slate-300 px-0.5 py-1 text-right tabular-nums">
            {formatNum(totals.salePrice)}
          </td>
          <td className="border border-slate-300 px-0.5 py-1 text-right tabular-nums">
            {formatNum(totals.supplyTotal)}
          </td>
          <td className="border border-slate-300 px-0.5 py-1 text-right tabular-nums text-blue-800">
            {formatNum(totals.margin)}
          </td>
          {renderRowActions && <td className="border border-slate-300" />}
        </tr>
      );
    }

    return (
      <tr
        key={`summary-${group.key}`}
        className="bg-amber-50/80 font-semibold text-slate-800"
      >
        {showSelect && <td className="border border-slate-300" />}
        {showStatus && <td className="border border-slate-300" />}
        <td
          colSpan={VENDOR_HEADERS.length}
          className="border border-slate-300 px-1 py-1 text-left text-[9px] leading-snug"
          title={group.title}
        >
          {label} · 판매 {formatNum(totals.salePrice)} · 매입{" "}
          {formatNum(totals.supplyTotal)} · 마진{" "}
          <span className="text-blue-800">{formatNum(totals.margin)}</span>
        </td>
        {renderRowActions && <td className="border border-slate-300" />}
      </tr>
    );
  };

  const renderBodyRows = () => {
    if (columnMode === "completed") {
      return completedGroups.flatMap((group) => [
        renderGroupSummaryRow(group, "completed"),
        ...group.orders.map((order) => renderDataRow(order)),
      ]);
    }

    if (showGroupSummaries && completedGroups.length > 0) {
      return [
        ...completedGroups.flatMap((group) => [
          renderGroupSummaryRow(group, "vendor"),
          ...group.orders.map((order) => renderDataRow(order)),
        ]),
        ...nonExportedOrders.map((order) => renderDataRow(order)),
      ];
    }

    return orders.map((order) => renderDataRow(order));
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-300 bg-white px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-slate-900">
            {sheetTitle(sheetKind)}
          </p>
          <p className="shrink-0 whitespace-nowrap text-[10px] text-slate-500">
            (단위:원)
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
          {columnMode === "seller" ? (
            <>
              {headerSummaryLabel && (
                <span className="text-[10px] font-medium text-slate-500">
                  {headerSummaryLabel}
                </span>
              )}
              <div className="rounded bg-slate-100 px-2 py-0.5 text-right">
                <p className="text-[9px] text-slate-500">판매가</p>
                <p className="text-xs font-bold tabular-nums">
                  {formatKrw(headerTotals.salePrice)}
                </p>
              </div>
              <div className="rounded bg-emerald-50 px-2 py-0.5 text-right">
                <p className="text-[9px] text-emerald-700">매입가</p>
                <p className="text-xs font-bold tabular-nums text-emerald-900">
                  {formatKrw(headerTotals.purchasePrice)}
                </p>
              </div>
              <div className="rounded bg-blue-100 px-2 py-0.5 text-right">
                <p className="text-[9px] text-blue-700">마진</p>
                <p className="text-xs font-bold tabular-nums text-blue-900">
                  {formatKrw(headerTotals.margin)}
                </p>
              </div>
            </>
          ) : columnMode === "completed" ? null : (
            <div className="rounded bg-yellow-200 px-2 py-0.5 text-right">
              <p className="text-[9px] font-medium text-slate-600">
                셀틱 입금액
              </p>
              <p className="text-xs font-bold tabular-nums text-slate-900">
                {formatKrw(celticTotal)}
              </p>
            </div>
          )}
        </div>
      </div>

      <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
        <thead>
          <tr className="bg-slate-100 text-slate-800">
            {showSelect && (
              <th className="w-[2%] border border-slate-300 px-0.5 py-1">
                <input
                  type="checkbox"
                  className="h-3 w-3 rounded border-slate-400"
                  checked={allSelected}
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                />
              </th>
            )}
            {showStatus && (
              <th className="w-[5%] border border-slate-300 px-0.5 py-1 text-center font-semibold">
                상태
              </th>
            )}
            {headers.map((h) => (
              <th
                key={h}
                className={`border border-slate-300 px-0.5 py-1 text-center font-semibold ${
                  COLUMN_WIDTHS[columnMode]?.[h] ?? ""
                } ${h === "셀틱 입금액" ? "bg-yellow-100" : ""}`}
              >
                {VENDOR_COMPACT[h] ?? h}
              </th>
            ))}
            {renderRowActions && (
              <th className="w-[4%] border border-slate-300 px-0.5 py-1 text-center font-semibold">
                관리
              </th>
            )}
          </tr>
        </thead>
        <tbody>{renderBodyRows()}</tbody>
        {columnMode !== "completed" && !showGroupSummaries && (
          <tfoot>
            <tr className="bg-slate-50 font-semibold text-slate-800">
              {showSelect && <td className="border border-slate-300" />}
              {showStatus && <td className="border border-slate-300" />}
              <td
                colSpan={columnMode === "seller" ? 10 : 10}
                className="border border-slate-300 px-1 py-1 text-right text-[10px]"
              >
                합계 ({orders.length}건)
              </td>
              {columnMode === "seller" ? (
                <>
                  <td className="border border-slate-300 px-0.5 py-1 text-right tabular-nums">
                    {formatNum(priceTotals.salePrice)}
                  </td>
                  <td className="border border-slate-300 px-0.5 py-1 text-right tabular-nums">
                    {formatNum(priceTotals.purchasePrice)}
                  </td>
                  <td className="border border-slate-300 px-0.5 py-1 text-right tabular-nums text-blue-800">
                    {formatNum(priceTotals.margin)}
                  </td>
                </>
              ) : (
                <>
                  <td className="border border-slate-300 px-0.5 py-1 text-right tabular-nums">
                    —
                  </td>
                  <td className="border border-slate-300 px-0.5 py-1 text-right tabular-nums">
                    —
                  </td>
                  <td className="border border-slate-300 px-0.5 py-1 text-right tabular-nums">
                    {formatNum(supplyTotal)}
                  </td>
                  <td className="border border-slate-300 bg-yellow-100 px-0.5 py-1 text-right tabular-nums">
                    {formatNum(celticTotal)}
                  </td>
                </>
              )}
              {renderRowActions && <td className="border border-slate-300" />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
