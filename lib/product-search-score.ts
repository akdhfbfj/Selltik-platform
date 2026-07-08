import type { SellerProductView } from "./types";

function normalizeForScore(s: string): string {
  return s.replace(/\s/g, "").toLowerCase();
}

/** 분석 상품명에서 검색·추천용 토큰 추출 */
export function tokenizeProductHint(hint: string): string[] {
  const trimmed = hint.trim();
  if (!trimmed) return [];

  const tokens = new Set<string>();
  const norm = normalizeForScore(trimmed);
  if (norm.length >= 2) tokens.add(norm);

  for (const part of trimmed.match(/[가-힣]{2,}/g) ?? []) {
    tokens.add(part);
  }
  for (const part of trimmed.match(/[a-z0-9]{2,}/gi) ?? []) {
    tokens.add(part.toLowerCase());
  }

  return [...tokens];
}

/** 분석값과 상품의 유사도 (높을수록 추천) */
export function scoreProductRelevance(
  hint: string,
  product: SellerProductView
): number {
  const query = hint.trim();
  if (!query) return 0;

  const sms = normalizeForScore(product.smsName);
  const official = normalizeForScore(product.officialName);
  const q = normalizeForScore(query);
  let score = 0;

  if (sms && sms === q) score += 100;
  else if (sms && (sms.includes(q) || q.includes(sms))) score += 45;

  if (official.includes(q) || q.includes(official)) score += 25;

  for (const tok of tokenizeProductHint(query)) {
    if (tok.length < 2) continue;
    if (sms.includes(tok)) score += 12;
    if (official.includes(tok)) score += 6;
  }

  if (product.isFavorite) score += 3;
  if (product.lastOutboundAt) score += 2;

  return score;
}

export function rankProductsByHint(
  products: SellerProductView[],
  hint: string
): SellerProductView[] {
  const q = hint.trim();
  if (!q) return products;

  return [...products]
    .map((p) => ({ p, score: scoreProductRelevance(q, p) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.sortOrder - b.p.sortOrder)
    .map((x) => x.p);
}

export function productMatchesHintFilter(
  product: SellerProductView,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (
    product.officialName.toLowerCase().includes(q) ||
    product.smsName.toLowerCase().includes(q)
  ) {
    return true;
  }
  return scoreProductRelevance(query, product) > 0;
}
