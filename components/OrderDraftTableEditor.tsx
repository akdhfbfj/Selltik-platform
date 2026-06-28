"use client";

import {
  matchProductBySmsName,
  recalcAllDraftLines,
  recalcDraftLineItem,
} from "@/lib/order-draft-helpers";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { OrderDraftBundle, OrderDraftLineItem, SellerProductView } from "@/lib/types";

const cellInput =
  "w-full min-w-0 rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100";

interface Props {
  bundle: OrderDraftBundle;
  onChange: (bundle: OrderDraftBundle) => void;
  products?: SellerProductView[];
  onAddressBlur?: (address: string) => void;
  postcodeLoading?: boolean;
  /** 분석 원문 상품명 — 양식 반영 전후 비교용 */
  rawProductNames?: string[];
}

export default function OrderDraftTableEditor({
  bundle,
  onChange,
  products = [],
  onAddressBlur,
  postcodeLoading = false,
  rawProductNames = [],
}: Props) {
  const updateBundle = (patch: Partial<OrderDraftBundle>) => {
    const next = { ...bundle, ...patch };
    onChange({
      ...next,
      lines: recalcAllDraftLines(next, products),
    });
  };

  const updateLine = (lineId: string, patch: Partial<OrderDraftLineItem>) => {
    onChange({
      ...bundle,
      lines: bundle.lines.map((line) => {
        if (line.id !== lineId) return line;
        let next = { ...line, ...patch };

        if (patch.productName !== undefined && products.length > 0) {
          const { product, matchedBy } = matchProductBySmsName(
            patch.productName,
            products
          );
          if (product) {
            next = {
              ...next,
              productId: product.id,
              productName: product.officialName,
              productMatch: {
                productId: product.id,
                officialName: product.officialName,
                matchedBy,
                consumerPrice: product.consumerPrice,
              },
            };
          } else {
            next = {
              ...next,
              productId: null,
              productMatch: {
                productId: null,
                officialName: null,
                matchedBy: "none",
                consumerPrice: 0,
              },
            };
          }
        }

        if (
          patch.purchasePrice !== undefined ||
          patch.shippingFee !== undefined
        ) {
          const purchase = patch.purchasePrice ?? line.purchasePrice;
          const shipping = patch.shippingFee ?? line.shippingFee;
          const total = purchase + shipping;
          return {
            ...next,
            purchasePrice: purchase,
            shippingFee: shipping,
            supplyTotal: total,
            celticDepositAmount: total,
          };
        }

        return recalcDraftLineItem(
          next,
          products,
          bundle.postalCode,
          bundle.address,
          bundle.isRemoteArea
        );
      }),
    });
  };

  const lineTotal = (line: OrderDraftLineItem) =>
    line.supplyTotal > 0
      ? line.supplyTotal
      : (line.purchasePrice + line.shippingFee) * line.quantity;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
      <table className="min-w-[1080px] w-full border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-100 text-[10px] font-semibold text-slate-700">
            <th className="min-w-[140px] border-r border-slate-200 px-2 py-2">
              제품명
            </th>
            <th className="w-12 border-r border-slate-200 px-1 py-2 text-center">
              수량
            </th>
            <th className="min-w-[72px] border-r border-slate-200 px-1 py-2">
              주문자
            </th>
            <th className="min-w-[72px] border-r border-slate-200 px-1 py-2">
              수령인
            </th>
            <th className="min-w-[100px] border-r border-slate-200 px-1 py-2">
              연락처1
            </th>
            <th className="min-w-[100px] border-r border-slate-200 px-1 py-2">
              연락처2
            </th>
            <th className="w-16 border-r border-slate-200 px-1 py-2">
              우편번호
            </th>
            <th className="min-w-[180px] border-r border-slate-200 px-1 py-2">
              주소
            </th>
            <th className="min-w-[80px] border-r border-slate-200 px-1 py-2">
              배송메모
            </th>
            <th className="w-20 border-r border-slate-200 px-1 py-2 text-right">
              매입가
            </th>
            <th className="w-16 border-r border-slate-200 px-1 py-2 text-right">
              택배비
            </th>
            <th className="w-20 px-1 py-2 text-right">계</th>
          </tr>
        </thead>
        <tbody>
          {bundle.lines.map((line, lineIdx) => (
            <tr
              key={line.id}
              className={`border-b border-slate-100 align-top ${
                line.productMatch.matchedBy === "none"
                  ? "bg-amber-50/40"
                  : "bg-sky-50/30"
              }`}
            >
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  className={cellInput}
                  value={line.productName}
                  onChange={(e) =>
                    updateLine(line.id, { productName: e.target.value })
                  }
                  placeholder="공급가표 상품명"
                />
                {rawProductNames[lineIdx] &&
                  rawProductNames[lineIdx].trim() !== line.productName.trim() && (
                    <p className="mt-0.5 text-[9px] text-slate-500">
                      분석: {rawProductNames[lineIdx]}
                    </p>
                  )}
                {line.productMatch.matchedBy === "none" && (
                  <p className="mt-0.5 text-[9px] text-amber-700">
                    공급가표 확인
                  </p>
                )}
              </td>
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  type="number"
                  min={1}
                  className={`${cellInput} text-center tabular-nums`}
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(line.id, {
                      quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                />
              </td>
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  className={cellInput}
                  value={bundle.ordererName}
                  onChange={(e) => updateBundle({ ordererName: e.target.value })}
                />
              </td>
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  className={cellInput}
                  value={bundle.recipientName}
                  onChange={(e) =>
                    updateBundle({ recipientName: e.target.value })
                  }
                />
              </td>
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  className={cellInput}
                  value={bundle.contactPhone}
                  onChange={(e) =>
                    updateBundle({ contactPhone: e.target.value })
                  }
                />
              </td>
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  className={cellInput}
                  value={bundle.contactPhone2}
                  onChange={(e) =>
                    updateBundle({ contactPhone2: e.target.value })
                  }
                />
              </td>
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  className={`${cellInput} tabular-nums`}
                  value={bundle.postalCode}
                  placeholder={postcodeLoading ? "…" : ""}
                  onChange={(e) => updateBundle({ postalCode: e.target.value })}
                />
              </td>
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  className={cellInput}
                  value={bundle.address}
                  onChange={(e) => updateBundle({ address: e.target.value })}
                  onBlur={(e) => onAddressBlur?.(e.target.value)}
                />
              </td>
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  className={cellInput}
                  value={bundle.shippingMemo}
                  onChange={(e) =>
                    updateBundle({ shippingMemo: e.target.value })
                  }
                />
              </td>
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  type="number"
                  min={0}
                  className={`${cellInput} text-right tabular-nums`}
                  value={line.purchasePrice || ""}
                  onChange={(e) =>
                    updateLine(line.id, {
                      purchasePrice: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </td>
              <td className="border-r border-slate-100 px-1 py-1">
                <input
                  type="number"
                  min={0}
                  className={`${cellInput} text-right tabular-nums`}
                  value={line.shippingFee || ""}
                  onChange={(e) =>
                    updateLine(line.id, {
                      shippingFee: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </td>
              <td className="px-1 py-1 text-right font-semibold tabular-nums text-slate-900">
                {formatKrw(lineTotal(line))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
