import { v4 as uuidv4 } from "uuid";
import { cleanOcrProductName } from "./ocr-cleanup";
import { calcOrderPricing } from "./order-pricing";
import type {
  OrderDraftBundle,
  OrderDraftLineItem,
  OrderDraftPreview,
  SellerProductView,
} from "./types";

function normalizeName(s: string): string {
  return cleanOcrProductName(s).replace(/\s/g, "").toLowerCase();
}

/** 셀러 SKU(smsName) 정확·포함 매칭 */
export function matchProductBySku(
  query: string,
  products: SellerProductView[]
): SellerProductView | null {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return null;

  const exact = products.find(
    (p) => p.smsName.trim().toLowerCase() === q
  );
  if (exact) return exact;

  const token = q.split(/\s+/)[0];
  if (token.length >= 2) {
    const tokenHit = products.find(
      (p) => p.smsName.trim().toLowerCase() === token
    );
    if (tokenHit) return tokenHit;
  }

  return null;
}

export function findProductBySkuInText(
  text: string,
  products: SellerProductView[]
): SellerProductView | null {
  const unique = findUniqueProductBySkuInText(text, products);
  if (unique) return unique;

  const lower = text.toLowerCase();
  const sorted = [...products]
    .filter((p) => p.smsName.trim().length >= 2)
    .sort((a, b) => b.smsName.trim().length - a.smsName.trim().length);

  for (const p of sorted) {
    const sku = p.smsName.trim();
    if (sku && lower.includes(sku.toLowerCase())) return p;
  }
  return null;
}

/** 원문에 SKU가 1건만 포함될 때만 자동 매칭 */
export function findUniqueProductBySkuInText(
  text: string,
  products: SellerProductView[]
): SellerProductView | null {
  const lower = text.toLowerCase();
  const hits = products.filter((p) => {
    const sku = p.smsName.trim();
    return sku.length >= 2 && lower.includes(sku.toLowerCase());
  });
  if (hits.length === 1) return hits[0];
  return null;
}

export function matchProductBySmsName(
  productName: string,
  products: SellerProductView[]
): {
  product: SellerProductView | null;
  matchedBy: OrderDraftLineItem["productMatch"]["matchedBy"];
} {
  const cleaned = cleanOcrProductName(productName);
  const query = normalizeName(cleaned);
  if (!query) return { product: null, matchedBy: "none" };

  const skuHit = matchProductBySku(cleaned, products);
  if (skuHit) return { product: skuHit, matchedBy: "sms_alias" };

  const aliasHit = products.find(
    (p) => p.smsName && normalizeName(p.smsName) === query
  );
  if (aliasHit) return { product: aliasHit, matchedBy: "sms_alias" };

  const uniqueInText = findUniqueProductBySkuInText(cleaned, products);
  if (uniqueInText) return { product: uniqueInText, matchedBy: "sms_alias" };

  return { product: null, matchedBy: "none" };
}

export function filterMeaningfulProductLines<
  T extends { productName: string; quantity: number },
>(lines: T[]): T[] {
  return lines.filter((line) => !isNoiseProductLineName(line.productName));
}

export function isNoiseProductLineName(name: string): boolean {
  const s = name.trim();
  if (s.length < 2) return true;
  if (/발주서\s*작성|주문서\s*작성|분석하기|붙여넣기|XML\s*가져오기/i.test(s)) {
    return true;
  }
  if (/입력하세요|틱톡\s*닉네임|입금자명/i.test(s)) return true;
  if (/^[\d\s×xX.…]+$/.test(s)) return true;
  if (/^\d{1,2}:\d{2}\b/.test(s)) return true;
  if (/\bLTE\b/i.test(s)) return true;
  if (/^[\|\¢\$<>]/.test(s)) return true;
  if (/^all\s/i.test(s)) return true;
  if (!/[가-힣]/.test(s) && s.length < 5) return true;
  return false;
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
    productName: product?.officialName ?? "",
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

export function emptyDraftLine(_products?: SellerProductView[]): OrderDraftLineItem {
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
