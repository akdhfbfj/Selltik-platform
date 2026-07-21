import { calcShippingFee } from "./remote-area";
import type { OrderDraftPreview, SellerProductView } from "./types";

export type OrderPricingProduct = Pick<
  SellerProductView,
  "purchasePrice" | "baseShipping" | "supplyTotal" | "consumerPrice"
>;

export interface OrderPricingResult {
  purchasePrice: number;
  shippingFee: number;
  supplyTotal: number;
  celticDepositAmount: number;
  customerDepositAmount: number;
  marginAmount: number;
  isRemoteArea: boolean;
  unitSupplyTotal: number;
  remoteSurcharge: number;
}

/** 공급가표 E열(계) × 수량 + 도서산간 추가 */
export function calcOrderPricing(
  product: OrderPricingProduct | null | undefined,
  quantity: number,
  postalCode: string,
  address: string,
  remoteChecked: boolean
): OrderPricingResult {
  const qty = Math.max(1, quantity);
  const unitPurchase = product?.purchasePrice ?? 0;
  const unitBaseShipping = product?.baseShipping ?? 0;
  const unitSupply =
    product?.supplyTotal ?? unitPurchase + unitBaseShipping;
  const unitConsumer = product?.consumerPrice ?? 0;

  const purchasePrice = unitPurchase * qty;
  const { isRemoteArea, remoteSurcharge } = calcShippingFee(
    unitBaseShipping,
    postalCode,
    address,
    { isRemoteArea: remoteChecked, remoteLineCount: 1 }
  );
  const shippingFee = unitBaseShipping * qty + remoteSurcharge;
  // 제주·도서산간 +4천: 고객에게 받고 셀틱에도 동일 금액 전달(통과) → 마진 불변
  const celticDepositAmount = unitSupply * qty + remoteSurcharge;
  const customerDepositAmount = unitConsumer * qty + remoteSurcharge;

  return {
    purchasePrice,
    shippingFee,
    supplyTotal: celticDepositAmount,
    celticDepositAmount,
    customerDepositAmount,
    marginAmount: customerDepositAmount - celticDepositAmount,
    isRemoteArea,
    unitSupplyTotal: unitSupply,
    remoteSurcharge,
  };
}

export function recalcDraftPricing(
  draft: OrderDraftPreview,
  product: SellerProductView | null | undefined,
  remoteChecked: boolean
): Pick<
  OrderDraftPreview,
  "purchasePrice" | "shippingFee" | "supplyTotal" | "celticDepositAmount" | "isRemoteArea"
> {
  const pricing = calcOrderPricing(
    product,
    draft.quantity,
    draft.postalCode,
    draft.address,
    remoteChecked
  );
  return {
    purchasePrice: pricing.purchasePrice,
    shippingFee: pricing.shippingFee,
    supplyTotal: pricing.supplyTotal,
    celticDepositAmount: pricing.celticDepositAmount,
    isRemoteArea: pricing.isRemoteArea,
  };
}
