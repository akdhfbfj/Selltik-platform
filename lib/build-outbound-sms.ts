import { formatKrw } from "./parse-supply-csv";
import { REMOTE_SHIPPING_SURCHARGE } from "./remote-area";

export interface OutboundSmsProduct {
  smsName: string;
  officialName: string;
  consumerPrice: number;
}

export interface OutboundCartLine {
  product: OutboundSmsProduct;
  quantity: number;
}

function displayName(product: OutboundSmsProduct): string {
  return product.smsName.trim() || product.officialName;
}

export interface OutboundSmsBodyOptions {
  isRemoteArea?: boolean;
}

/** 장바구니 → 본문 (1개: 단가만, 2개+: 단가 x 수량 = 합계) */
export function buildOutboundSmsBodyFromCart(
  items: OutboundCartLine[],
  options?: OutboundSmsBodyOptions
): string {
  if (items.length === 0) return "";

  const lines = items.map(({ product, quantity }) => {
    const name = displayName(product);
    const unit = formatKrw(product.consumerPrice);
    if (quantity === 1) return `· ${name} ${unit}`;
    const lineTotal = product.consumerPrice * quantity;
    return `· ${name} ${unit} x ${quantity} = ${formatKrw(lineTotal)}`;
  });

  const subtotal = items.reduce(
    (sum, { product, quantity }) => sum + product.consumerPrice * quantity,
    0
  );

  const remoteSurcharge = options?.isRemoteArea
    ? REMOTE_SHIPPING_SURCHARGE * items.length
    : 0;
  const grandTotal = subtotal + remoteSurcharge;

  const tail = [`합계 ${formatKrw(subtotal)}`];
  if (remoteSurcharge > 0) {
    const lineLabel =
      items.length > 1
        ? ` (품목 ${items.length}건)`
        : "";
    tail.push(
      `제주·도서산간 +${formatKrw(remoteSurcharge)}${lineLabel}`,
      `총 ${formatKrw(grandTotal)}`
    );
  }

  return [...lines, "", ...tail].join("\n");
}

export function calcOutboundRemoteSurcharge(
  lineCount: number,
  isRemoteArea: boolean
): number {
  if (!isRemoteArea || lineCount <= 0) return 0;
  return REMOTE_SHIPPING_SURCHARGE * lineCount;
}

export function composeOutboundSms(
  header: string,
  body: string,
  footer: string
): string {
  return [header.trim(), body.trim(), footer.trim()].filter(Boolean).join("\n\n");
}
