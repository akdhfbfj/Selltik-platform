"use client";

import { useMemo, useState } from "react";
import KakaoPostcodePicker, {
  type PostcodePickResult,
} from "@/components/KakaoPostcodePicker";
import ProductSearchInput from "@/components/ProductSearchInput";
import { calcOrderPricing } from "@/lib/order-pricing";
import { formatKrw } from "@/lib/parse-supply-csv";
import { formatPhoneLiveInput } from "@/lib/parse-order-sms";
import {
  buildDraftLineItem,
  emptyDraftLine,
  recalcAllDraftLines,
  recalcDraftLineItem,
} from "@/lib/order-draft-helpers";
import { SELLER_INPUT_CLASS } from "@/lib/seller-ui";
import type { OrderDraftBundle, OrderDraftLineItem, SellerProductView } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  bundle: OrderDraftBundle;
  onChange: (bundle: OrderDraftBundle) => void;
  products: SellerProductView[];
  onAddressStatus?: (message: string) => void;
  rawProductNames?: string[];
  /** 분석 원문 주소 (우측 패널과 동일) */
  rawAddressHint?: string;
  /** 분석 직후 주소 검색창 자동 오픈 */
  addressSearchTrigger?: number;
}

export default function ReplyDraftFormEditor({
  bundle,
  onChange,
  products,
  onAddressStatus,
  rawProductNames = [],
  rawAddressHint,
  addressSearchTrigger = 0,
}: Props) {
  const [closeAddressSearch, setCloseAddressSearch] = useState(0);

  const closeAddressPicker = () => {
    setCloseAddressSearch((n) => n + 1);
  };
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
        const next = { ...line, ...patch };
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

  const handleProductSelect = (lineId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    onChange({
      ...bundle,
      lines: bundle.lines.map((line) => {
        if (line.id !== lineId) return line;
        const built = buildDraftLineItem(
          products,
          product.officialName,
          line.quantity,
          bundle.postalCode,
          bundle.address,
          bundle.isRemoteArea
        );
        return { ...built, id: line.id, quantity: line.quantity };
      }),
    });
  };

  const applyPostcodePick = (result: PostcodePickResult) => {
    const next = {
      ...bundle,
      postalCode: result.postalCode,
      address: result.address,
    };
    onChange({
      ...next,
      lines: recalcAllDraftLines(next, products),
    });
  };

  const addLine = () => {
    onChange({
      ...bundle,
      lines: [...bundle.lines, emptyDraftLine(products)],
    });
  };

  const removeLine = (lineId: string) => {
    if (bundle.lines.length <= 1) return;
    onChange({
      ...bundle,
      lines: bundle.lines.filter((line) => line.id !== lineId),
    });
  };

  const bundleTotals = useMemo(() => {
    let sale = 0;
    let purchase = 0;
    let margin = 0;
    for (const line of bundle.lines) {
      const product = line.productId
        ? products.find((p) => p.id === line.productId)
        : null;
      const pricing = calcOrderPricing(
        product,
        line.quantity,
        bundle.postalCode,
        bundle.address,
        bundle.isRemoteArea
      );
      sale += pricing.customerDepositAmount;
      purchase += pricing.celticDepositAmount;
      margin += pricing.marginAmount;
    }
    return { sale, purchase, margin };
  }, [bundle, products]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">상품 목록</p>
        <button
          type="button"
          onClick={addLine}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          상품 추가
        </button>
      </div>

      {bundle.lines.map((line, idx) => (
        <div
          key={line.id}
          className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              상품 {idx + 1}
              {line.productMatch.matchedBy !== "none" && (
                <span className="ml-2 text-emerald-600">
                  ✓{" "}
                  {line.productMatch.matchedBy === "sms_alias"
                    ? "SKU·문자용명"
                    : "공급가표"}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {rawProductNames[idx] && (
                <span className="text-[11px] text-slate-400">
                  분석: {rawProductNames[idx]}
                </span>
              )}
              {bundle.lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className="flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                  title="상품 삭제"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                제품명
              </label>
              <ProductSearchInput
                products={products}
                value={line.productId ?? ""}
                onChange={(productId) => handleProductSelect(line.id, productId)}
                placeholder="SKU·공급가표 상품명 검색"
                seedQuery={rawProductNames[idx] ?? ""}
                onFocus={closeAddressPicker}
              />
              {line.productMatch.matchedBy === "none" && (
                <p className="mt-1 text-[11px] text-amber-700">
                  공급가표에 없는 상품명입니다. SKU·상품명으로 검색해 선택하세요.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
              <div className="w-[4.5rem] shrink-0">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  수량
                </label>
                <input
                  type="number"
                  min={1}
                  className={`${SELLER_INPUT_CLASS} tabular-nums`}
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(line.id, {
                      quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  금액
                </label>
                {(() => {
                  const product = line.productId
                    ? products.find((p) => p.id === line.productId)
                    : null;
                  const pricing = calcOrderPricing(
                    product,
                    line.quantity,
                    bundle.postalCode,
                    bundle.address,
                    bundle.isRemoteArea
                  );
                  return (
                    <p className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums text-slate-600">
                      판매{" "}
                      <strong className="text-slate-900">
                        {formatKrw(pricing.customerDepositAmount)}
                      </strong>
                      {" · "}매입{" "}
                      <strong className="text-slate-900">
                        {formatKrw(pricing.celticDepositAmount)}
                      </strong>
                      {" · "}마진{" "}
                      <strong
                        className={
                          pricing.marginAmount >= 0
                            ? "text-blue-700"
                            : "text-red-600"
                        }
                      >
                        {formatKrw(pricing.marginAmount)}
                      </strong>
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <p className="text-xs font-semibold text-slate-700">합계 금액</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs tabular-nums">
          <div>
            <span className="text-slate-500">판매가</span>
            <p className="font-bold text-slate-900">
              {formatKrw(bundleTotals.sale)}
            </p>
          </div>
          <div>
            <span className="text-slate-500">매입(셀틱)</span>
            <p className="font-bold text-slate-900">
              {formatKrw(bundleTotals.purchase)}
            </p>
          </div>
          <div>
            <span className="text-slate-500">마진</span>
            <p
              className={`font-bold ${
                bundleTotals.margin >= 0 ? "text-blue-700" : "text-red-600"
              }`}
            >
              {formatKrw(bundleTotals.margin)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            주문자
          </label>
          <input
            className={SELLER_INPUT_CLASS}
            value={bundle.ordererName}
            onChange={(e) => updateBundle({ ordererName: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            수령인
          </label>
          <input
            className={SELLER_INPUT_CLASS}
            value={bundle.recipientName}
            onChange={(e) => updateBundle({ recipientName: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            연락처
          </label>
          <input
            className={SELLER_INPUT_CLASS}
            value={bundle.contactPhone}
            onChange={(e) =>
              updateBundle({ contactPhone: formatPhoneLiveInput(e.target.value) })
            }
            placeholder="010-0000-0000"
            inputMode="tel"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            배송메모
          </label>
          <input
            className={SELLER_INPUT_CLASS}
            value={bundle.shippingMemo}
            onChange={(e) => updateBundle({ shippingMemo: e.target.value })}
            placeholder="부재 시 연락 등"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            우편번호
          </label>
          <input
            className={`${SELLER_INPUT_CLASS} max-w-[8rem] tabular-nums`}
            value={bundle.postalCode}
            placeholder="주소 추출 후 자동 입력"
            onChange={(e) => updateBundle({ postalCode: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            주소
          </label>
          {rawAddressHint && rawAddressHint !== bundle.address && (
            <p className="mb-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
              원문: {rawAddressHint}
            </p>
          )}
          <KakaoPostcodePicker
            rawAddress={bundle.address}
            onPick={applyPostcodePick}
            onStatus={onAddressStatus}
            autoOpenTrigger={addressSearchTrigger}
            closeSignal={closeAddressSearch}
            searchButtonBelow
            searchButtonLabel="주소 추출 시작"
            inputSlot={
              <input
                className={`${SELLER_INPUT_CLASS} w-full min-w-0`}
                value={bundle.address}
                onChange={(e) => updateBundle({ address: e.target.value })}
                placeholder="분석된 주소 · 수정 가능"
              />
            }
          />
          {!bundle.postalCode.trim() && bundle.address.trim() && (
            <p className="mt-1.5 text-[11px] text-amber-700">
              「주소 추출 시작」→ 검색 결과 클릭하면 우편번호·정제 주소가
              채워집니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
