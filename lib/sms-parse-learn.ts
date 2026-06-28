import {
  normalizePhone,
  type ParsedOrderSms,
  parseOrderSms,
} from "./parse-order-sms";
import type {
  GlobalLearnField,
  LearnField,
  SmsParseSampleRow,
} from "./sms-parse-samples";
import { GLOBAL_LEARN_FIELDS } from "./sms-parse-samples";
import { fetchLearningSamples } from "./sms-parse-samples";

export interface LearnedLabelPattern {
  field: GlobalLearnField;
  regex: RegExp;
  hits: number;
}

export interface ProductHint {
  fromText: string;
  toName: string;
  toQuantity?: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeProductKey(s: string): string {
  return s.replace(/\s/g, "").toLowerCase();
}

function phoneDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function extractPostcode(text: string): string {
  const m = text.match(/\b(\d{5})\b/);
  return m?.[1] ?? "";
}

/** 수정된 샘플에서 라벨 패턴 추출 (예: "핸" → 연락처) */
export function extractLearnedLabelPatterns(
  samples: SmsParseSampleRow[]
): LearnedLabelPattern[] {
  const counts = new Map<string, LearnedLabelPattern>();

  for (const sample of samples) {
    const lines = sample.raw_sms_text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (const field of sample.corrected_fields) {
      if (!GLOBAL_LEARN_FIELDS.includes(field as GlobalLearnField)) continue;

      const correct = String(sample.seller_final[field] ?? "").trim();
      if (!correct || correct.length < 2) continue;

      for (const line of lines) {
        const regex = inferLabelRegex(line, field, correct);
        if (!regex) continue;

        const key = `${field}:${regex.source}`;
        const existing = counts.get(key);
        if (existing) {
          existing.hits += 1;
        } else {
          counts.set(key, { field: field as GlobalLearnField, regex, hits: 1 });
        }
      }
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 80);
}

function inferLabelRegex(
  line: string,
  field: LearnField,
  correctValue: string
): RegExp | null {
  const lineNorm = line.trim();

  if (field === "contactPhone" || field === "contactPhone2") {
    const digits = phoneDigits(correctValue);
    if (digits.length < 10 || !phoneDigits(lineNorm).includes(digits)) {
      return null;
    }
    const phoneRe = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/;
    const m = lineNorm.match(
      new RegExp(`^(.+?)(${phoneRe.source})`, "i")
    );
    if (!m) return null;
    const label = m[1].trim().replace(/[:：]$/, "");
    if (label.length < 1 || label.length > 20) return null;
    return new RegExp(
      `^${escapeRegex(label)}\\s*[:：]?\\s*(.+)$`,
      "i"
    );
  }

  if (field === "address" || field === "postalCode") {
    const probe = correctValue.slice(0, Math.min(10, correctValue.length));
    const idx = lineNorm.indexOf(probe);
    if (idx <= 0) return null;
    const prefix = lineNorm.slice(0, idx).trim().replace(/[:：]$/, "");
    if (prefix.length < 1 || prefix.length > 15) return null;
    return new RegExp(
      `^${escapeRegex(prefix)}\\s*[:：]?\\s*(.+)$`,
      "i"
    );
  }

  const idx = lineNorm.indexOf(correctValue);
  if (idx <= 0) return null;
  const prefix = lineNorm.slice(0, idx).trim().replace(/[:：]$/, "");
  if (prefix.length < 1 || prefix.length > 15) return null;
  if (/\d{5,}/.test(prefix)) return null;

  return new RegExp(`^${escapeRegex(prefix)}\\s*[:：]?\\s*(.+)$`, "i");
}

function setLearnedField(
  result: ParsedOrderSms,
  field: GlobalLearnField,
  raw: string
): void {
  const val = raw.trim();
  if (!val) return;

  if (field === "contactPhone") {
    result.contactPhone = normalizePhone(val);
    return;
  }
  if (field === "contactPhone2") {
    result.contactPhone2 = normalizePhone(val);
    return;
  }
  if (field === "address") {
    result.address = val;
    const pc = extractPostcode(val);
    if (pc) result.postalCode = pc;
    return;
  }
  if (field === "postalCode") {
    result.postalCode = val.replace(/\D/g, "").slice(0, 5);
    return;
  }
  if (field === "ordererName") result.ordererName = val;
  else if (field === "recipientName") result.recipientName = val;
  else if (field === "shippingMemo") result.shippingMemo = val;
}

/** 학습된 라벨 패턴으로 빈 필드·오인식 필드 보정 */
export function applyLearnedLabelPatterns(
  parsed: ParsedOrderSms,
  rawText: string,
  patterns: LearnedLabelPattern[]
): ParsedOrderSms {
  const result = { ...parsed };
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const { field, regex, hits } of patterns) {
    for (const line of lines) {
      const m = line.match(regex);
      if (!m?.[1]) continue;

      const extracted = m[1].trim();
      const current = String(result[field] ?? "").trim();

      const shouldApply =
        !current ||
        (hits >= 2 && current !== extracted && current.length < extracted.length);

      if (shouldApply) {
        setLearnedField(result, field, extracted);
      }
      break;
    }
  }

  return result;
}

/** 셀러별 상품·수량 수정 이력 → 힌트 맵 */
export function extractProductHints(
  samples: SmsParseSampleRow[]
): ProductHint[] {
  const hints: ProductHint[] = [];
  const seen = new Set<string>();

  for (const sample of samples) {
    if (
      !sample.corrected_fields.some(
        (f) => f === "productName" || f === "quantity"
      )
    ) {
      continue;
    }

    const auto = sample.auto_parsed;
    const finalName = String(sample.seller_final.productName ?? "").trim();
    const finalQty = Number(sample.seller_final.quantity) || 0;
    if (!finalName) continue;

    const autoKey = normalizeProductKey(auto.productName);
    if (autoKey) {
      const key = `${autoKey}=>${finalName}`;
      if (!seen.has(key)) {
        seen.add(key);
        hints.push({
          fromText: autoKey,
          toName: finalName,
          toQuantity: finalQty > 0 ? finalQty : undefined,
        });
      }
    }

    const rawLines = sample.raw_sms_text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of rawLines) {
      const colonPrice = line.match(/^(.+?)\s*[:：]\s*\d/);
      if (colonPrice) {
        const norm = normalizeProductKey(colonPrice[1].trim());
        if (norm && norm !== normalizeProductKey(finalName)) {
          const key = `colon:${norm}=>${finalName}`;
          if (!seen.has(key)) {
            seen.add(key);
            hints.push({
              fromText: norm,
              toName: finalName,
              toQuantity: finalQty > 0 ? finalQty : undefined,
            });
          }
        }
      }

      if (!/[x×X]\s*\d|\d+\s*개/.test(line)) continue;
      const namePart = line
        .replace(/[x×X]\s*\d+.*/i, "")
        .replace(/\d+\s*개.*/i, "")
        .trim();
      const norm = normalizeProductKey(namePart);
      if (!norm || norm === normalizeProductKey(finalName)) continue;

      const key = `line:${norm}=>${finalName}`;
      if (!seen.has(key)) {
        seen.add(key);
        hints.push({
          fromText: norm,
          toName: finalName,
          toQuantity: finalQty > 0 ? finalQty : undefined,
        });
      }
    }
  }

  return hints;
}

export function applyProductHints(
  parsed: ParsedOrderSms,
  rawText: string,
  hints: ProductHint[]
): ParsedOrderSms {
  const result = { ...parsed };
  const parsedKey = normalizeProductKey(result.productName);
  const rawKey = normalizeProductKey(rawText);

  for (const hint of hints) {
    const matched =
      (parsedKey && (parsedKey === hint.fromText || parsedKey.includes(hint.fromText))) ||
      rawKey.includes(hint.fromText) ||
      rawText
        .split(/\r?\n/)
        .some((line) => normalizeProductKey(line).includes(hint.fromText));

    if (!matched) continue;

    result.productName = hint.toName;
    if (hint.toQuantity && hint.toQuantity > 0) {
      result.quantity = hint.toQuantity;
    }
    break;
  }

  return result;
}

export function applySmsLearnings(
  parsed: ParsedOrderSms,
  rawText: string,
  samples: { global: SmsParseSampleRow[]; shopProduct: SmsParseSampleRow[] }
): ParsedOrderSms {
  const labelPatterns = extractLearnedLabelPatterns(samples.global);
  let result = applyLearnedLabelPatterns(parsed, rawText, labelPatterns);

  const productHints = extractProductHints(samples.shopProduct);
  result = applyProductHints(result, rawText, productHints);

  return result;
}

/** 규칙 파싱 + 누적 학습 반영 */
export async function parseOrderSmsWithLearning(
  text: string,
  shopId: string
): Promise<ParsedOrderSms> {
  const base = parseOrderSms(text);
  try {
    const samples = await fetchLearningSamples(shopId);
    if (samples.global.length === 0 && samples.shopProduct.length === 0) {
      return base;
    }
    return applySmsLearnings(base, text, samples);
  } catch (e) {
    console.error("sms parse learning failed:", e);
    return base;
  }
}
