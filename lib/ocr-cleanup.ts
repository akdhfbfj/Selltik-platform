/** OCR·캡처 텍스트에서 흔한 오인식 보정 */

export function cleanOcrProductName(name: string): string {
  return name
    .replace(/(\d)\s*[<>]\s*(\d)/g, "$1kg")
    .replace(/(\d)\s*k\s*g/gi, "$1kg")
    .replace(/[%]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanOcrAddress(address: string): string {
  let s = address
    .replace(/[—–―]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  // 327-2204% / 327-2204호 → 327-2 204호 (도로번지-본번-호수 OCR 붙음)
  s = s.replace(
    /(\d+)-(\d)(\d{2,4})[%호]?(?=\s|$|[가-힣(])/g,
    (_, road, sep, unit) => `${road}-${sep} ${unit}호`
  );

  s = s.replace(/(\d)\s*%\s*(?=[가-힣]|$)/g, "$1호 ");
  s = s.replace(/%/g, "");

  return s.trim();
}

export function cleanOcrSmsText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (/[시군구읍면동로길]/.test(line)) return cleanOcrAddress(line);
      if (/\d/.test(line) && /[가-힣]/.test(line) && line.length < 60) {
        return cleanOcrProductName(line);
      }
      return line;
    })
    .join("\n");
}

/** OCR 주소 줄 앞의 라틴·기호 잡음 제거 */
export function cleanOcrAddressLine(line: string): string {
  let s = cleanOcrAddress(line);

  const region = s.match(
    /((?:서울특별시|서울시|서울|부산광역시|부산시|부산|대구광역시|대구시|대구|인천광역시|인천시|인천|광주광역시|광주시|광주|대전광역시|대전시|대전|울산광역시|울산시|울산|세종특별자치시|세종시|세종|경기도|경기|강원특별자치도|강원도|강원|충청북도|충북|충청남도|충남|전라북도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주도|제주)\s*.+)/
  );
  if (region) return cleanOcrAddress(region[1]);

  const admin = s.match(
    /([가-힣]{2,4}(?:시|군|구|읍|면)\s+[가-힣]+(?:로|길|대로|거리|번길|번로)\s*.+)/
  );
  if (admin) return cleanOcrAddress(admin[1]);

  const roadOnly = s.match(
    /([가-힣A-Za-z0-9]+(?:로|길|대로|거리|번길|번로)\s*\d[\d\-]*(?:\s+.+)?)/
  );
  if (roadOnly && /^[A-Za-z0-9\s~\-_]{3,}/.test(s.slice(0, s.indexOf(roadOnly[1])))) {
    return cleanOcrAddress(roadOnly[1]);
  }

  return s;
}

/** OCR 전체 텍스트에서 도로명·지번 주소 구간 추출 */
export function extractAddressFromOcrText(text: string): string {
  let best = "";

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cleaned = cleanOcrAddressLine(trimmed);
    if (!/(?:로|길|대로|거리|번길|번로)\s*\d/.test(cleaned)) continue;
    if (!/[가-힣]{2,}/.test(cleaned)) continue;
    if (cleaned.length > best.length) best = cleaned;
  }

  if (best) return best;

  const compact = text.replace(/\s+/g, " ").trim();
  const road = compact.match(
    /[가-힣A-Za-z0-9]+(?:로|길|대로|거리|번길|번로)\s*\d[\d\-]*(?:\s+[\w가-힣]+(?:아파트|동|호)?)+/
  );
  if (road) return cleanOcrAddressLine(road[0]);

  return best;
}

export function isLikelyGarbledAddress(address: string): boolean {
  const s = address.trim();
  if (!s) return false;
  if (/^(?:경기|서울|부산|대구|인천|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/.test(s)) {
    return false;
  }
  if (/^[A-Za-z0-9\s~\-_]{4,}/.test(s) && !/[가-힣]{2,}(시|군|구|읍|면|도)/.test(s)) {
    return true;
  }
  if (!/[가-힣]/.test(s.slice(0, 8))) return true;
  return false;
}

/** 카카오 표준 주소 + 원문의 리·단지·호수 보존 */
export function mergeAddressDetail(raw: string, normalized: string): string {
  const r = cleanOcrAddress(raw).replace(/\s+/g, " ").trim();
  const n = normalized.replace(/\s+/g, " ").trim();
  if (!n) return r;
  if (r.includes(n)) return formatAddressParts(r);

  const extras: string[] = [];
  const normCompact = n.replace(/\s/g, "");

  const ri = r.match(/([가-힣]{1,4}리)(?:\s|\)|$)/);
  if (ri && !n.includes(ri[1])) extras.push(`(${ri[1]})`);

  const apt = r.match(
    /([가-힣A-Za-z0-9]+(?:타운|아파트|APT|apt|빌라|마을|힐스|팰리스|빌|맨션))/
  );
  if (apt && !normCompact.includes(apt[1].replace(/\s/g, ""))) {
    extras.push(apt[1]);
  }

  const ho = r.match(/(?:^|\s)(\d{1,4})\s*호(?:\s|$)/);
  if (ho && !n.includes(`${ho[1]}호`) && !n.includes(ho[1])) {
    extras.push(`${ho[1]}호`);
  }

  const normParts = new Set(n.split(" "));
  for (const part of r.split(" ")) {
    if (normParts.has(part)) continue;
    if (/^[\d-]+호?$/.test(part) && !extras.some((e) => e.includes(part))) {
      extras.push(part.endsWith("호") ? part : `${part}호`);
    }
  }

  const unique = [...new Set(extras)];
  const merged = unique.length ? `${n} ${unique.join(" ")}`.trim() : n;
  return formatAddressParts(merged);
}

/** '경기도' → '경기' 등 발주 양식에 맞게 축약 */
function formatAddressParts(address: string): string {
  return address
    .replace(/경기도/g, "경기")
    .replace(/전라북도/g, "전북")
    .replace(/전라남도/g, "전남")
    .replace(/경상북도/g, "경북")
    .replace(/경상남도/g, "경남")
    .replace(/충청북도/g, "충북")
    .replace(/충청남도/g, "충남")
    .replace(/강원특별자치도/g, "강원")
    .replace(/강원도/g, "강원")
    .replace(/제주특별자치도/g, "제주")
    .replace(/제주도/g, "제주")
    .replace(/서울특별시/g, "서울")
    .replace(/부산광역시/g, "부산")
    .replace(/대구광역시/g, "대구")
    .replace(/인천광역시/g, "인천")
    .replace(/광주광역시/g, "광주")
    .replace(/대전광역시/g, "대전")
    .replace(/울산광역시/g, "울산")
    .replace(/세종특별자치시/g, "세종")
    .replace(/\s+/g, " ")
    .trim();
}
