import {
  matchProductBySmsName,
  recalcAllDraftLines,
  recalcDraftLineItem,
} from "./order-draft-helpers";
import { calcOrderPricing } from "./order-pricing";
import { cleanOcrAddress, cleanOcrProductName } from "./ocr-cleanup";
import { normalizePhone } from "./parse-order-sms";
import { resolveFullAddressFromText } from "./resolve-postal-code";
import type {
  OrderDraftBundle,
  OrderDraftLineItem,
  SellerProductView,
} from "./types";

export interface RefineProductChange {
  rawName: string;
  officialName: string | null;
  matched: boolean;
}

export interface RefineAddressChange {
  rawAddress: string;
  normalizedAddress: string;
  postalCode: string;
}

export interface RefineChangeSummary {
  products: RefineProductChange[];
  address: RefineAddressChange | null;
}

function phonesFromRaw(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(
    /\+82[\s.-]?1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/g
  )) {
    const digits = m[0].replace(/[^\d]/g, "");
    if (digits.startsWith("82")) found.push(normalizePhone(`0${digits.slice(2)}`));
  }
  for (const m of text.matchAll(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g)) {
    found.push(normalizePhone(m[0]));
  }
  return [...new Set(found)];
}

/** 분석 결과에 공급가표·우편번호·금액을 반영합니다. */
export async function refineOrderDraftBundle(
  bundle: OrderDraftBundle,
  products: SellerProductView[]
): Promise<{ bundle: OrderDraftBundle; changes: RefineChangeSummary }> {
  let next: OrderDraftBundle = { ...bundle };
  const productChanges: RefineProductChange[] = [];

  if (!next.ordererName.trim() && next.recipientName.trim()) {
    next.ordererName = next.recipientName;
  }
  if (!next.recipientName.trim() && next.ordererName.trim()) {
    next.recipientName = next.ordererName;
  }

  if (!next.contactPhone.trim() && next.rawSmsText.trim()) {
    const phones = phonesFromRaw(next.rawSmsText);
    if (phones[0]) next.contactPhone = phones[0];
  }

  if (next.address.trim()) {
    next.address = cleanOcrAddress(next.address);
  }

  next.lines = bundle.lines.map((line) => {
    const rawName = cleanOcrProductName(line.productName.trim());
    const { product, matchedBy } = matchProductBySmsName(rawName, products);

    productChanges.push({
      rawName,
      officialName: product?.officialName ?? null,
      matched: matchedBy !== "none",
    });

    if (product) {
      const pricing = calcOrderPricing(
        product,
        line.quantity,
        next.postalCode,
        next.address,
        next.isRemoteArea
      );
      const refinedLine: OrderDraftLineItem = {
        ...line,
        productId: product.id,
        productName: product.officialName,
        quantity: line.quantity,
        purchasePrice: pricing.purchasePrice,
        shippingFee: pricing.shippingFee,
        supplyTotal: pricing.supplyTotal,
        celticDepositAmount: pricing.celticDepositAmount,
        productMatch: {
          productId: product.id,
          officialName: product.officialName,
          matchedBy,
          consumerPrice: product.consumerPrice,
        },
      };
      return refinedLine;
    }

    return recalcDraftLineItem(
      {
        ...line,
        productId: null,
        productName: "",
        productMatch: {
          productId: null,
          officialName: null,
          matchedBy: "none",
          consumerPrice: 0,
        },
      },
      products,
      next.postalCode,
      next.address,
      next.isRemoteArea
    );
  });

  let addressChange: RefineAddressChange | null = null;
  if (next.address.trim()) {
    const resolved = await resolveFullAddressFromText(next.address);
    if (resolved) {
      addressChange = {
        rawAddress: next.address,
        normalizedAddress: resolved.address,
        postalCode: resolved.postalCode,
      };
      next.postalCode = resolved.postalCode;
      next.address = resolved.address;
    }
  }

  next.lines = recalcAllDraftLines(next, products);

  return {
    bundle: next,
    changes: { products: productChanges, address: addressChange },
  };
}

export function buildReplyDraftLabel(bundle: OrderDraftBundle): string {
  const who = bundle.recipientName.trim() || bundle.ordererName.trim() || "수령인 미입력";
  const products = bundle.lines
    .map((l) => l.productName.trim())
    .filter(Boolean)
    .join(", ");
  return products ? `${who} · ${products}` : who;
}
