import { v4 as uuidv4 } from "uuid";
import { calcOrderPricing } from "./order-pricing";
import type {
  OrderDraftBundle,
  OrderDraftLineItem,
  OrderDraftPreview,
  SellerProductView,
} from "./types";

function normalizeName(s: string): string {
  return s.replace(/\s/g, "").toLowerCase();
}

export function matchProductBySmsName(
  productName: string,
  products: SellerProductView[]
): {
  product: SellerProductView | null;
  matchedBy: OrderDraftLineItem["productMatch"]["matchedBy"];
} {
  const query = normalizeName(productName);
  if (!query) return { product: null, matchedBy: "none" };

  const aliasHit = products.find(
    (p) => p.smsName && normalizeName(p.smsName) === query
  );
  if (aliasHit) return { product: aliasHit, matchedBy: "sms_alias" };

  const aliasContains = products.find(
    (p) =>
      p.smsName &&
      (normalizeName(p.smsName).includes(query) ||
        query.includes(normalizeName(p.smsName)))
  );
  if (aliasContains) return { product: aliasContains, matchedBy: "sms_alias" };

  const officialHit = products.find(
    (p) => normalizeName(p.officialName) === query
  );
  if (officialHit) return { product: officialHit, matchedBy: "official_name" };

  const officialContains = products.find(
    (p) =>
      normalizeName(p.officialName).includes(query) ||
      query.includes(normalizeName(p.officialName))
  );
  if (officialContains)
    return { product: officialContains, matchedBy: "official_name" };

  return { product: null, matchedBy: "none" };
}

export function buildDraftLineItem(
  products: SellerProductView[],
  productName: string,
  quantity: number,
  postalCode: string,
  address: string,
  isRemoteArea: boolean
): OrderDraftLineItem {
  const { product, matchedBy } = matchProductBySmsName(productName, products);
  const pricing = calcOrderPricing(
    product,
    quantity,
    postalCode,
    address,
    isRemoteArea
  );

  return {
    id: uuidv4(),
    productId: product?.id ?? null,
    productName: product?.officialName ?? productName,
    quantity,
    purchasePrice: pricing.purchasePrice,
    shippingFee: pricing.shippingFee,
    supplyTotal: pricing.supplyTotal,
    celticDepositAmount: pricing.celticDepositAmount,
    productMatch: {
      productId: product?.id ?? null,
      officialName: product?.officialName ?? null,
      matchedBy,
      consumerPrice: product?.consumerPrice ?? 0,
    },
  };
}

export function recalcDraftLineItem(
  line: OrderDraftLineItem,
  products: SellerProductView[],
  postalCode: string,
  address: string,
  isRemoteArea: boolean
): OrderDraftLineItem {
  const product = line.productId
    ? products.find((p) => p.id === line.productId)
    : null;
  const pricing = calcOrderPricing(
    product,
    line.quantity,
    postalCode,
    address,
    isRemoteArea
  );
  return {
    ...line,
    purchasePrice: pricing.purchasePrice,
    shippingFee: pricing.shippingFee,
    supplyTotal: pricing.supplyTotal,
    celticDepositAmount: pricing.celticDepositAmount,
    productMatch: product
      ? {
          productId: product.id,
          officialName: product.officialName,
          matchedBy: line.productMatch.matchedBy,
          consumerPrice: product.consumerPrice,
        }
      : line.productMatch,
  };
}

export function recalcAllDraftLines(
  bundle: {
    postalCode: string;
    address: string;
    isRemoteArea: boolean;
    lines: OrderDraftLineItem[];
  },
  products: SellerProductView[]
): OrderDraftLineItem[] {
  return bundle.lines.map((line) =>
    recalcDraftLineItem(
      line,
      products,
      bundle.postalCode,
      bundle.address,
      bundle.isRemoteArea
    )
  );
}

export function emptyDraftLine(products: SellerProductView[]): OrderDraftLineItem {
  if (products[0]) {
    return buildDraftLineItem(
      products,
      products[0].officialName,
      1,
      "",
      "",
      false
    );
  }
  return {
    id: uuidv4(),
    productId: null,
    productName: "",
    quantity: 1,
    purchasePrice: 0,
    shippingFee: 0,
    supplyTotal: 0,
    celticDepositAmount: 0,
    productMatch: {
      productId: null,
      officialName: null,
      matchedBy: "none",
      consumerPrice: 0,
    },
  };
}

export function bundleLineToOrderPayload(
  bundle: OrderDraftBundle,
  line: OrderDraftLineItem
): OrderDraftPreview {
  return {
    customerOrderDate: bundle.customerOrderDate,
    orderDate: bundle.orderDate,
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    ordererName: bundle.ordererName,
    recipientName: bundle.recipientName,
    contactPhone: bundle.contactPhone,
    contactPhone2: bundle.contactPhone2,
    postalCode: bundle.postalCode,
    address: bundle.address,
    shippingMemo: bundle.shippingMemo,
    purchasePrice: line.purchasePrice,
    shippingFee: line.shippingFee,
    supplyTotal: line.supplyTotal,
    isRemoteArea: bundle.isRemoteArea,
    rawSmsText: bundle.rawSmsText,
    status: "draft",
    productMatch: line.productMatch,
    celticDepositAmount: line.celticDepositAmount,
    autoParsed: bundle.autoParsed,
  };
}
