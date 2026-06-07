import { formatKrw } from "./parse-supply-csv";

export interface OutboundSmsProduct {
  smsName: string;
  officialName: string;
  consumerPrice: number;
  baseShipping: number;
}

export function buildOutboundSmsBody(
  product: OutboundSmsProduct,
  quantity: number
): string {
  const name = product.smsName.trim() || product.officialName;
  const unit = product.consumerPrice;
  const total = unit * quantity;

  const lines = [
    `▶ ${name}`,
    `수량: ${quantity}개`,
    `개당 ${formatKrw(unit)}`,
    `합계 ${formatKrw(total)}`,
  ];

  if (product.baseShipping > 0) {
    lines.push(`※ 배송비 ${formatKrw(product.baseShipping)} 별도 (제주·도서산간 +4,000원)`);
  }

  return lines.join("\n");
}

export function composeOutboundSms(
  header: string,
  body: string,
  footer: string
): string {
  return [header.trim(), body.trim(), footer.trim()].filter(Boolean).join("\n\n");
}
