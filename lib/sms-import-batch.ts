import type { OrderDraftBundle } from "./types";

export const SMS_IMPORT_BATCH_MAX = 80;

export interface SmsImportBatchItem {
  id: string;
  body: string;
  dateIso: string;
}

export interface SmsImportParseResult {
  sourceId: string;
  ok: boolean;
  error?: string;
  draftBundle?: OrderDraftBundle;
  duplicateOrderIds: string[];
  warnings: string[];
}

export function collectImportWarnings(
  bundle: OrderDraftBundle,
  duplicateCount: number
): string[] {
  const warnings: string[] = [];
  if (!bundle.contactPhone?.trim()) warnings.push("연락처 없음");
  if (!bundle.address?.trim()) warnings.push("주소 없음");
  if (!bundle.ordererName?.trim() && !bundle.recipientName?.trim()) {
    warnings.push("이름 없음");
  }
  const unmatched = bundle.lines.filter(
    (l) => l.productMatch.matchedBy === "none" && l.productName.trim()
  );
  if (unmatched.length > 0) {
    warnings.push(`상품 미매칭 ${unmatched.length}건`);
  }
  if (duplicateCount > 0) {
    warnings.push(`기존 발주 ${duplicateCount}건과 중복`);
  }
  return warnings;
}
