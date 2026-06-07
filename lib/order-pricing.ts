import { calcShippingFee } from "./remote-area";
import type { SellerProductView } from "./types";

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
  const celticDepositAmount = unitSupply * qty + remoteSurcharge;
  const customerDepositAmount = unitConsumer * qty;

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
