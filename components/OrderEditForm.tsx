"use client";

import KakaoPostcodePicker, {
  type PostcodePickResult,
} from "@/components/KakaoPostcodePicker";
import ProductSearchInput from "@/components/ProductSearchInput";
import { calcOrderPricing, recalcDraftPricing } from "@/lib/order-pricing";
import { formatKrw } from "@/lib/parse-supply-csv";
import { REMOTE_SHIPPING_SURCHARGE } from "@/lib/remote-area";
import { SELLER_INPUT_CLASS } from "@/lib/seller-ui";
import type { Order, SellerProductView } from "@/lib/types";
import { Check, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";

export type OrderEditState = {
  productId: string | null;
  customerOrderDate: string;
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
  shippingFee: number;
  supplyTotal: number;
  celticDepositAmount: number;
  isRemoteArea: boolean;
  status: Order["status"];
  rawSmsText: string;
};

export function orderToEditState(order: Order): OrderEditState {
  return {
    productId: order.productId,
    customerOrderDate: order.customerOrderDate,
    orderDate: order.orderDate,
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
    shippingFee: order.shippingFee,
    supplyTotal: order.supplyTotal,
    celticDepositAmount: order.celticDepositAmount ?? order.supplyTotal,
    isRemoteArea: order.isRemoteArea,
    status: order.status,
    rawSmsText: order.rawSmsText,
  };
}

interface OrderEditFormProps {
  order: Order;
  products: SellerProductView[];
  saving?: boolean;
  inModal?: boolean;
  onSave: (payload: OrderEditState) => void;
  onCancel: () => void;
}

export default function OrderEditForm({
  order,
  products,
  saving = false,
  inModal = false,
  onSave,
  onCancel,
}: OrderEditFormProps) {
  const [form, setForm] = useState<OrderEditState>(() => orderToEditState(order));

  const product = form.productId
    ? products.find((p) => p.id === form.productId)
    : null;

  const pricing = useMemo(
    () =>
      calcOrderPricing(
        product,
        form.quantity,
        form.postalCode,
        form.address,
        form.isRemoteArea
      ),
    [product, form.quantity, form.postalCode, form.address, form.isRemoteArea]
  );

  const patch = (next: Partial<OrderEditState>) =>
    setForm((prev) => ({ ...prev, ...next }));

  const applyPricing = (
    base: OrderEditState,
    p: SellerProductView | null | undefined,
    remote: boolean
  ) => ({
    ...base,
    ...recalcDraftPricing(
      {
        ...base,
        productMatch: {
          productId: p?.id ?? null,
          officialName: p?.officialName ?? null,
          matchedBy: "official_name",
          consumerPrice: p?.consumerPrice ?? 0,
        },
      },
      p,
      remote
    ),
  });

  const handleProductSelect = (productId: string) => {
    const hit = products.find((p) => p.id === productId);
    if (!hit) return;
    setForm((prev) =>
      applyPricing(
        {
          ...prev,
          productId: hit.id,
          productName: hit.officialName,
        },
        hit,
        prev.isRemoteArea
      )
    );
  };

  const applyPostcodePick = (result: PostcodePickResult) => {
    setForm((prev) =>
      applyPricing(
        { ...prev, postalCode: result.postalCode, address: result.address },
        product,
        prev.isRemoteArea
      )
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const supplyTotal = pricing.purchasePrice + form.shippingFee;
        onSave({
          ...form,
          purchasePrice: pricing.purchasePrice,
          shippingFee: form.shippingFee,
          supplyTotal,
          celticDepositAmount: supplyTotal,
          isRemoteArea: pricing.isRemoteArea,
        });
      }}
      className={`${inModal ? "p-6" : "mb-6 rounded-2xl border border-blue-200 bg-blue-50/20 p-6 shadow-sm"}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">발주 수정</h3>
          <p className="mt-1 text-xs text-slate-500">
            {order.productName} · {order.recipientName}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-600"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            주문일
          </label>
          <input
            type="date"
            className={SELLER_INPUT_CLASS}
            value={form.customerOrderDate}
            onChange={(e) => patch({ customerOrderDate: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            발주일
          </label>
          <input
            type="date"
            className={SELLER_INPUT_CLASS}
            value={form.orderDate}
            onChange={(e) => patch({ orderDate: e.target.value })}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            xlsx 묶음·목록 그룹 기준
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            상품 선택
          </label>
          <ProductSearchInput
            products={products}
            value={form.productId ?? ""}
            onChange={handleProductSelect}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            수량
          </label>
          <input
            type="number"
            min={1}
            className={SELLER_INPUT_CLASS}
            value={form.quantity}
            onChange={(e) => {
              const quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
              setForm((prev) =>
                applyPricing({ ...prev, quantity }, product, prev.isRemoteArea)
              );
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            주문자
          </label>
          <input
            className={SELLER_INPUT_CLASS}
            value={form.ordererName}
            onChange={(e) => patch({ ordererName: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            수령인
          </label>
          <input
            className={SELLER_INPUT_CLASS}
            value={form.recipientName}
            onChange={(e) => patch({ recipientName: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            연락처1
          </label>
          <input
            className={SELLER_INPUT_CLASS}
            value={form.contactPhone}
            onChange={(e) => patch({ contactPhone: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            연락처2
          </label>
          <input
            className={SELLER_INPUT_CLASS}
            value={form.contactPhone2}
            onChange={(e) => patch({ contactPhone2: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            우편번호
          </label>
          <input
            className={SELLER_INPUT_CLASS}
            value={form.postalCode}
            onChange={(e) => patch({ postalCode: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            주소
          </label>
          <KakaoPostcodePicker
            rawAddress={form.address}
            onPick={applyPostcodePick}
            onStatus={() => {}}
            inputSlot={
              <input
                className={`${SELLER_INPUT_CLASS} min-w-0 flex-1`}
                value={form.address}
                onChange={(e) => patch({ address: e.target.value })}
              />
            }
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            배송메모
          </label>
          <input
            className={SELLER_INPUT_CLASS}
            value={form.shippingMemo}
            onChange={(e) => patch({ shippingMemo: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              checked={form.isRemoteArea}
              onChange={(e) =>
                setForm((prev) =>
                  applyPricing(prev, product, e.target.checked)
                )
              }
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">
                제주·도서산간 (+{formatKrw(REMOTE_SHIPPING_SURCHARGE)}/품목)
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] text-slate-500">매입가</p>
          <p className="text-sm font-semibold tabular-nums text-slate-800">
            {formatKrw(pricing.purchasePrice)}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">
            택배비 (수정 가능)
          </label>
          <input
            type="number"
            min={0}
            step={100}
            className={SELLER_INPUT_CLASS}
            value={form.shippingFee}
            onChange={(e) => {
              const shippingFee = Math.max(
                0,
                parseInt(e.target.value, 10) || 0
              );
              patch({ shippingFee });
            }}
          />
        </div>
        <div>
          <p className="text-[11px] text-slate-500">계 (매입+택배)</p>
          <p className="text-sm font-semibold tabular-nums text-slate-800">
            {formatKrw(pricing.purchasePrice + form.shippingFee)}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">셀틱 입금액</span>
          <span className="font-semibold text-emerald-700">
            {formatKrw(pricing.purchasePrice + form.shippingFee)}
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          수정 저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          취소
        </button>
      </div>
    </form>
  );
}
