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

const PHONE_PATTERN = "01[016789][-\\s.]?\\d{3,4}[-\\s.]?\\d{4}";

const REGION_PREFIXES = [
  "서울특별시",
  "서울시",
  "서울",
  "부산광역시",
  "부산시",
  "부산",
  "대구광역시",
  "대구시",
  "대구",
  "인천광역시",
  "인천시",
  "인천",
  "광주광역시",
  "광주시",
  "광주",
  "대전광역시",
  "대전시",
  "대전",
  "울산광역시",
  "울산시",
  "울산",
  "세종특별자치시",
  "세종시",
  "세종",
  "경기도",
  "경기",
  "강원특별자치도",
  "강원도",
  "강원",
  "충청북도",
  "충북",
  "충청남도",
  "충남",
  "전라북도",
  "전북",
  "전라남도",
  "전남",
  "경상북도",
  "경북",
  "경상남도",
  "경남",
  "제주특별자치도",
  "제주도",
  "제주",
];

function findRegionStart(text: string): number {
  let best = -1;
  for (const prefix of REGION_PREFIXES) {
    const idx = text.indexOf(prefix);
    if (idx >= 0 && (best < 0 || idx < best)) best = idx;
  }
  return best;
}

function hasRegion(text: string): boolean {
  return findRegionStart(text) >= 0;
}

function startsWithRegion(text: string): boolean {
  const s = text.trim();
  return REGION_PREFIXES.some((p) => s.startsWith(p));
}

const ADDRESS_HINT =
  /(?:시|군|구|읍|면|동|리|로|길|호|아파트|APT|빌|타운|빌라|마을)/;

const LABEL_PATTERNS: { key: keyof ParsedOrderSms; patterns: RegExp[] }[] = [
  {
    key: "ordererName",
    patterns: [
      /^(?:주문자|주문인|보내는\s*분|보내는분|입금자(?:명)?|입금자)\s*[:：]?\s*(.+)$/i,
    ],
  },
  {
    key: "recipientName",
    patterns: [
      /^(?:받는\s*분|받는분|수령인|수취인|받으실\s*분|받는\s*사람|성명|성함|이름)\s*[:：]?\s*(.+)$/i,
    ],
  },
  {
    key: "contactPhone",
    patterns: [
      /^(?:연락처\s*1?|휴대폰|핸드폰|핸|전화|받는분\s*전화(?:번호)?|연락처)\s*[:：]?\s*(.+)$/i,
    ],
  },
  {
    key: "contactPhone2",
    patterns: [/^(?:연락처\s*2|보조\s*연락처)\s*[:：]?\s*(.+)$/i],
  },
  {
    key: "address",
    patterns: [
      /^(?:주소|배송지|도로명\s*주소|배송\s*주소)\s*[:：]?\s*(.+)$/i,
    ],
  },
  {
    key: "shippingMemo",
    patterns: [
      /^(?:배송\s*메모|배송메모|요청\s*사항|요청사항|배송\s*요청|메모)\s*[:：]?\s*(.+)$/i,
    ],
  },
];

export function emptyResult(): ParsedOrderSms {
  return {
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
}

function extractPostcode(text: string): string {
  const paren = text.match(/\((\d{5})\)/);
  if (paren) return paren[1];
  const start = text.match(/^(\d{5})\b/);
  if (start) return start[1];
  return "";
}

function phoneRe(): RegExp {
  return new RegExp(PHONE_PATTERN, "g");
}

function hasPhone(text: string): boolean {
  return new RegExp(PHONE_PATTERN).test(text);
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
}

function extractPhones(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(phoneRe())) {
    found.push(normalizePhone(m[0]));
  }
  return [...new Set(found)];
}

function stripPhones(text: string): string {
  return text.replace(phoneRe(), " ");
}

function isOnlyPhoneLine(line: string): boolean {
  const trimmed = line.replace(/\s/g, "");
  return /^01[016789]\d{7,8}$/.test(trimmed);
}

export function looksLikeAddress(line: string): boolean {
  const s = line.trim();
  if (s.length < 4) return false;
  if (startsWithRegion(s)) return true;
  // 이름 + 주소 + 전화 한 줄은 별도 처리 (경기광주 등 시·도로 시작하는 줄은 위에서 처리)
  const nameRegion = s.match(/^([가-힣]{2,4})\s+/);
  if (nameRegion && isLikelyPersonName(nameRegion[1]) && hasRegion(s))
    return false;
  if (/^[가-힣]{2,5}시/.test(s)) return true;
  if (/(?:로|길)\d/.test(s) || /\d+\s*동\s*\d+\s*호/.test(s)) return true;
  if (ADDRESS_HINT.test(s) && /\d/.test(s) && !hasPhone(s)) return true;
  if (/^\d{5}\s/.test(s)) return true;
  return false;
}

const REGION_SHORT_NAMES = new Set([
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
]);

function isLikelyPersonName(s: string): boolean {
  if (!/^[가-힣]{2,5}$/.test(s)) return false;
  if (/시$|도$|구$|군$/.test(s)) return false;
  if (REGION_SHORT_NAMES.has(s)) return false;
  for (const prefix of REGION_SHORT_NAMES) {
    if (s.startsWith(prefix) && s.length > prefix.length) return false;
  }
  return true;
}

function normalizeNameToken(line: string): string {
  return line
    .replace(/\s*(입니다|이에요|예요|감사.*)$/g, "")
    .trim();
}

function isKoreanNameLine(line: string): boolean {
  const s = normalizeNameToken(line);
  if (s.length < 2 || s.length > 8) return false;
  if (/\d/.test(s)) return false;
  if (looksLikeAddress(s)) return false;
  if (hasPhone(s)) return false;
  if (/^(?:입금|주문|확인|네|넹|예|아고|오늘|은행)/.test(s)) return false;
  return /^[가-힣a-zA-Z0-9\s]{2,}$/.test(s);
}

function isSkippableLine(line: string): boolean {
  if (!line.trim()) return true;
  if (/^(?:\[.+\]|※|안내|주문\s*완료|배송\s*안내)/.test(line)) return true;
  if (/^[❤️💙🥰🙏😊^^~♡]+$/.test(line)) return true;
  if (
    /^(?:입금\s*(?:했|완|함)|입완|확인했어요|네|넹|예|주문\s*감사)/.test(line) &&
    !hasRegion(line) &&
    !/^[가-힣]{2,5}시/.test(line)
  )
    return true;
  if (/^입금\s*했어요\s*$/.test(line)) return true;
  if (/^입완/.test(line) && !hasRegion(line)) return true;
  if (/^(?:계좌|신랑|은행|현금영수증|무배|검수)/.test(line)) return true;
  return false;
}

function isLabelLine(line: string): boolean {
  return LABEL_PATTERNS.some(({ patterns }) =>
    patterns.some((re) => re.test(line))
  );
}

function parseQuantityFromLine(line: string): number | null {
  const patterns = [
    /(?:수량|qty)\s*[:：]?\s*(\d+)/i,
    /[xX×]\s*(\d+)/,
    /(\d+)\s*개/,
    /(\d+)\s*수량/,
    /(?:스몰|라지|미디엄|퀸)?\s*두\s*개/i,
    /(\d+)\s*주문/,
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (m) {
      if (/두\s*개/i.test(m[0])) return 2;
      return Math.max(1, parseInt(m[1], 10));
    }
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

function mergeAddressLines(lines: string[]): string {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTrailingNoise(text: string): string {
  return text
    .replace(/\s*(입니다|이에요|예요|감사합니다|감사해요)\s*$/g, "")
    .replace(/\s*당근\s*사랑\s*입니다\s*$/g, "")
    .trim();
}

function parseDenseSingleLine(line: string): Partial<ParsedOrderSms> {
  const phones = extractPhones(line);
  let rest = stripPhones(line);
  rest = rest.replace(/(?:입니다|당근\s*사랑\s*입니다)\s*$/g, "");
  rest = cleanTrailingNoise(rest);

  const partial: Partial<ParsedOrderSms> = {};
  if (phones[0]) partial.contactPhone = phones[0];
  if (phones[1]) partial.contactPhone2 = phones[1];

  const addrStart = findRegionStart(rest);

  if (addrStart >= 0) {
    const before = rest.slice(0, addrStart).trim();
    let after = rest.slice(addrStart).trim();

    const nameBefore = before.match(/^([가-힣]{2,4})$/);
    if (nameBefore && isLikelyPersonName(nameBefore[1]))
      partial.recipientName = nameBefore[1];

    const nameAfterMatch = after.match(
      /\s([가-힣]{2,4})(?:\s*(?:헤어샵|샵|몰))?\s*(?:입니다)?\s*$/
    );
    if (nameAfterMatch && isLikelyPersonName(nameAfterMatch[1])) {
      if (!partial.recipientName) partial.recipientName = nameAfterMatch[1];
      after = after.slice(0, nameAfterMatch.index).trim();
    } else {
      const nameTail = after.match(/\s([가-힣]{2,4})\s*$/);
      if (nameTail && isLikelyPersonName(nameTail[1])) {
        if (!partial.recipientName) partial.recipientName = nameTail[1];
        after = after.slice(0, nameTail.index).trim();
      }
    }

    partial.address = cleanTrailingNoise(after);
    const pc = extractPostcode(partial.address);
    if (pc) partial.postalCode = pc;
    return partial;
  }

  const cityLine = rest.trim();
  if (/^[가-힣]{2,5}시/.test(cityLine)) {
    let body = cityLine;
    const nameAfter = body.match(/\s([가-힣]{2,4})\s*(?:입니다)?\s*$/);
    if (nameAfter && isLikelyPersonName(nameAfter[1])) {
      partial.recipientName = nameAfter[1];
      body = body.slice(0, nameAfter.index).trim();
    }
    partial.address = body;
    const pc = extractPostcode(partial.address);
    if (pc) partial.postalCode = pc;
    return partial;
  }

  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2 && isLikelyPersonName(tokens[0])) {
    partial.recipientName = tokens[0];
    partial.address = tokens.slice(1).join(" ");
    const pc = extractPostcode(partial.address);
    if (pc) partial.postalCode = pc;
  }

  return partial;
}

function parseOrderedLines(lines: string[]): Partial<ParsedOrderSms> {
  const partial: Partial<ParsedOrderSms> = {};
  const remaining: string[] = [];

  for (const line of lines) {
    if (isOnlyPhoneLine(line) || (hasPhone(line) && !looksLikeAddress(line))) {
      const phones = extractPhones(line);
      if (!partial.contactPhone && phones[0]) partial.contactPhone = phones[0];
      else if (!partial.contactPhone2 && phones[0])
        partial.contactPhone2 = phones[0];
      continue;
    }
    remaining.push(line);
  }

  const addrIndices: number[] = [];
  for (let i = 0; i < remaining.length; i++) {
    if (looksLikeAddress(remaining[i])) addrIndices.push(i);
  }

  if (addrIndices.length > 0) {
    const groups: number[][] = [];
    let group = [addrIndices[0]];
    for (let i = 1; i < addrIndices.length; i++) {
      if (addrIndices[i] === addrIndices[i - 1] + 1) group.push(addrIndices[i]);
      else {
        groups.push(group);
        group = [addrIndices[i]];
      }
    }
    groups.push(group);

    const best = groups.reduce((a, b) => (a.length >= b.length ? a : b));
    partial.address = mergeAddressLines(best.map((i) => remaining[i]));
    const pc = extractPostcode(partial.address);
    if (pc) partial.postalCode = pc;

    const before = remaining.slice(0, best[0]).filter(isKoreanNameLine);
    const after = remaining
      .slice(best[best.length - 1] + 1)
      .filter(isKoreanNameLine);

    if (before.length >= 1)
      partial.ordererName = normalizeNameToken(before[0]);
    if (before.length >= 2 && before[1].length <= 6) {
      partial.shippingMemo = before[1];
    }
    if (after.length >= 1)
      partial.recipientName = normalizeNameToken(after[after.length - 1]);
    else if (before.length >= 1)
      partial.recipientName = normalizeNameToken(before[0]);

    return partial;
  }

  const names = remaining.filter(isKoreanNameLine);
  if (names.length >= 1) {
    partial.ordererName = names[0];
    partial.recipientName = names[names.length - 1];
  }

  return partial;
}

function applyPartial(result: ParsedOrderSms, partial: Partial<ParsedOrderSms>) {
  if (partial.ordererName?.trim() && !result.ordererName)
    result.ordererName = partial.ordererName.trim();
  if (partial.recipientName?.trim() && !result.recipientName)
    result.recipientName = partial.recipientName.trim();
  if (partial.contactPhone?.trim() && !result.contactPhone)
    result.contactPhone = partial.contactPhone.trim();
  if (partial.contactPhone2?.trim() && !result.contactPhone2)
    result.contactPhone2 = partial.contactPhone2.trim();
  if (partial.address?.trim() && !result.address)
    result.address = partial.address.trim();
  if (partial.postalCode?.trim() && !result.postalCode)
    result.postalCode = partial.postalCode.trim();
  if (partial.shippingMemo?.trim() && !result.shippingMemo)
    result.shippingMemo = partial.shippingMemo.trim();
  if (partial.productName?.trim() && !result.productName)
    result.productName = partial.productName.trim();
  if (partial.quantity && partial.quantity > 0) result.quantity = partial.quantity;
}

export function parseOrderSms(text: string): ParsedOrderSms {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const result = emptyResult();
  const productCandidates: string[] = [];
  const unstructured: string[] = [];

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
      if (qty) result.quantity = qty;
      const productLine = stripQuantityFromProduct(line);
      if (/주문|구매/i.test(productLine) && productLine.length >= 4) {
        productCandidates.push(productLine);
      } else if (!looksLikeAddress(productLine) && !hasPhone(productLine)) {
        unstructured.push(line);
      }
    }
  }

  if (!result.contactPhone) {
    const allPhones = extractPhones(text);
    if (allPhones[0]) result.contactPhone = allPhones[0];
    if (allPhones[1]) result.contactPhone2 = allPhones[1];
  }

  if (!result.address) {
    const usable = lines.filter((l) => !isSkippableLine(l) && !isLabelLine(l));
    applyPartial(result, parseOrderedLines(usable));
  }

  if (!result.address || !result.recipientName) {
    for (const line of lines) {
      if (isSkippableLine(line) || isLabelLine(line)) continue;
      const lineHasPhone = hasPhone(line);
      const hasRegionInLine = hasRegion(line);
      if (lineHasPhone && (hasRegionInLine || line.length > 25)) {
        applyPartial(result, parseDenseSingleLine(line));
      }
    }
  }

  if (!result.address) {
    const addrLines: string[] = [];
    for (const line of lines) {
      if (isSkippableLine(line) || isLabelLine(line)) continue;
      if (looksLikeAddress(line) && !isOnlyPhoneLine(line)) {
        addrLines.push(line);
      }
    }
    if (addrLines.length > 0) {
      result.address = mergeAddressLines(addrLines);
      const pc = extractPostcode(result.address);
      if (pc) result.postalCode = pc;
    }
  }

  if (!result.recipientName || !result.ordererName) {
    const names = unstructured
      .map(normalizeNameToken)
      .filter(isKoreanNameLine);
    if (!result.ordererName && names[0]) result.ordererName = names[0];
    if (!result.recipientName) {
      result.recipientName = names[names.length - 1] || result.ordererName;
    }
  }

  for (const line of lines) {
    const pc = extractPostcode(line);
    if (pc && !result.postalCode) result.postalCode = pc;
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

/** 문자 상단에서 상품·수량 라인 추출 (복수 상품) */
export function parseProductLinesFromSms(
  text: string,
  parsed?: ParsedOrderSms
): { productName: string; quantity: number }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items: { productName: string; quantity: number }[] = [];

  for (const line of lines) {
    if (isSkippableLine(line) || isLabelLine(line)) continue;
    if (looksLikeAddress(line) || hasPhone(line)) continue;

    const qty = parseQuantityFromLine(line);
    const hasQtyMarker = qty !== null || /[x×X]\s*\d/.test(line);
    if (!hasQtyMarker) continue;

    const name = stripQuantityFromProduct(line).trim();
    if (name.length < 2) continue;
    if (/^(받는|수령|연락|주소|배송|입금)/i.test(name)) continue;

    items.push({ productName: name, quantity: qty ?? 1 });
  }

  if (items.length === 0) {
    const p = parsed ?? parseOrderSms(text);
    if (p.productName.trim()) {
      items.push({
        productName: p.productName.trim(),
        quantity: p.quantity || 1,
      });
    }
  }

  return items;
}
