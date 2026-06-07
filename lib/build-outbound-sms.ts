import { formatKrw } from "./parse-supply-csv";

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

/** 장바구니 → 본문 (1개: 단가만, 2개+: 단가 x 수량 = 합계) */
export function buildOutboundSmsBodyFromCart(
  items: OutboundCartLine[]
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

  return [...lines, "", `합계 ${formatKrw(subtotal)}`].join("\n");
}

export function composeOutboundSms(
  header: string,
  body: string,
  footer: string
): string {
  return [header.trim(), body.trim(), footer.trim()].filter(Boolean).join("\n\n");
}
