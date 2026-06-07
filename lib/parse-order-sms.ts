export interface ParsedOrderSms {
  productName: string;
  quantity: number;
  ordererName: string;
  recipientName: string;
  contactPhone: string;
  contactPhone2: string;
  postalCode: string;
  address: string;
  shippingMemo: string;
}

const LABEL_PATTERNS: { key: keyof ParsedOrderSms; patterns: RegExp[] }[] = [
  {
    key: "ordererName",
    patterns: [/^(?:주문자|주문인|보내는\s*분|보내는분)\s*[:：]?\s*(.+)$/i],
  },
  {
    key: "recipientName",
    patterns: [/^(?:받는\s*분|받는분|수령인|수취인|받으실\s*분)\s*[:：]?\s*(.+)$/i],
  },
  {
    key: "contactPhone",
    patterns: [
      /^(?:연락처\s*1?|휴대폰|핸드폰|전화|연락처)\s*[:：]?\s*(.+)$/i,
    ],
  },
  {
    key: "contactPhone2",
    patterns: [/^(?:연락처\s*2|보조\s*연락처)\s*[:：]?\s*(.+)$/i],
  },
  {
    key: "address",
    patterns: [/^(?:주소|배송지|도로명\s*주소|배송\s*주소)\s*[:：]?\s*(.+)$/i],
  },
  {
    key: "shippingMemo",
    patterns: [
      /^(?:배송\s*메모|배송메모|요청\s*사항|요청사항|배송\s*요청|메모)\s*[:：]?\s*(.+)$/i,
    ],
  },
];

function extractPostcode(text: string): string {
  const paren = text.match(/\((\d{5})\)/);
  if (paren) return paren[1];
  const start = text.match(/^(\d{5})\b/);
  if (start) return start[1];
  return "";
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
}

function parseQuantityFromLine(line: string): number | null {
  const patterns = [
    /(?:수량|qty)\s*[:：]?\s*(\d+)/i,
    /[xX×]\s*(\d+)/,
    /(\d+)\s*개/,
    /(\d+)\s*수량/,
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (m) return Math.max(1, parseInt(m[1], 10));
  }
  return null;
}

function stripQuantityFromProduct(line: string): string {
  return line
    .replace(/(?:수량|qty)\s*[:：]?\s*\d+/gi, "")
    .replace(/[xX×]\s*\d+/g, "")
    .replace(/\d+\s*개/g, "")
    .trim();
}

function isLabelLine(line: string): boolean {
  return LABEL_PATTERNS.some(({ patterns }) =>
    patterns.some((re) => re.test(line))
  );
}

function isSkippableLine(line: string): boolean {
  if (!line.trim()) return true;
  if (/^(?:\[.+\]|※|안내|주문\s*완료|배송\s*안내)/.test(line)) return true;
  return false;
}

export function parseOrderSms(text: string): ParsedOrderSms {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const result: ParsedOrderSms = {
    productName: "",
    quantity: 1,
    ordererName: "",
    recipientName: "",
    contactPhone: "",
    contactPhone2: "",
    postalCode: "",
    address: "",
    shippingMemo: "",
  };

  const productCandidates: string[] = [];

  for (const line of lines) {
    if (isSkippableLine(line)) continue;

    let matched = false;
    for (const { key, patterns } of LABEL_PATTERNS) {
      for (const re of patterns) {
        const m = line.match(re);
        if (m) {
          const val = m[1].trim();
          if (key === "contactPhone") {
            result.contactPhone = normalizePhone(val);
          } else if (key === "contactPhone2") {
            result.contactPhone2 = normalizePhone(val);
          } else if (key === "address") {
            result.address = val;
            const pc = extractPostcode(val);
            if (pc) result.postalCode = pc;
          } else if (key === "ordererName") {
            result.ordererName = val;
          } else if (key === "recipientName") {
            result.recipientName = val;
          } else if (key === "shippingMemo") {
            result.shippingMemo = val;
          }
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched && !isLabelLine(line)) {
      const qty = parseQuantityFromLine(line);
      if (qty && !result.quantity) result.quantity = qty;
      const productLine = stripQuantityFromProduct(line);
      if (productLine.length >= 2) productCandidates.push(productLine);
    }
  }

  // 주소 한 줄에 우편번호만 있는 경우
  for (const line of lines) {
    const pc = extractPostcode(line);
    if (pc && !result.postalCode) result.postalCode = pc;
  }

  // 연락처가 라벨 없이 숫자만 있는 줄
  if (!result.contactPhone) {
    for (const line of lines) {
      const phoneMatch = line.match(/(01[016789][-\s]?\d{3,4}[-\s]?\d{4})/);
      if (phoneMatch) {
        result.contactPhone = normalizePhone(phoneMatch[1]);
        break;
      }
    }
  }

  if (!result.productName && productCandidates.length > 0) {
    result.productName = productCandidates[0];
  }

  if (!result.recipientName && result.ordererName) {
    result.recipientName = result.ordererName;
  }
  if (!result.ordererName && result.recipientName) {
    result.ordererName = result.recipientName;
  }

  const qtyInProduct = parseQuantityFromLine(result.productName);
  if (qtyInProduct) {
    result.quantity = qtyInProduct;
    result.productName = stripQuantityFromProduct(result.productName);
  }

  return result;
}
