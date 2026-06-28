import type { OrderDraftBundle, OrderInput } from "./types";
import type { ParsedOrderSms } from "./parse-order-sms";

/** 답장 양식 → 학습용 최종 스냅샷 (첫 상품 줄 기준) */
export function bundleToLearnOrderInput(bundle: OrderDraftBundle): OrderInput {
  const line = bundle.lines[0];
  return {
    productId: line?.productId ?? null,
    customerOrderDate: bundle.customerOrderDate,
    orderDate: bundle.orderDate,
    productName: line?.productName?.trim() ?? "",
    quantity: line?.quantity ?? 1,
    ordererName: bundle.ordererName.trim(),
    recipientName: bundle.recipientName.trim(),
    contactPhone: bundle.contactPhone.trim(),
    contactPhone2: bundle.contactPhone2.trim(),
    postalCode: bundle.postalCode.trim(),
    address: bundle.address.trim(),
    shippingMemo: bundle.shippingMemo.trim(),
    purchasePrice: line?.purchasePrice ?? 0,
    shippingFee: line?.shippingFee ?? 0,
    supplyTotal: line?.supplyTotal ?? 0,
    isRemoteArea: bundle.isRemoteArea,
    rawSmsText: bundle.rawSmsText,
    status: "draft",
  };
}

export function canSaveLearnSample(
  bundle: OrderDraftBundle,
  autoParsed?: ParsedOrderSms
): boolean {
  return Boolean(bundle.rawSmsText?.trim() && autoParsed);
}
