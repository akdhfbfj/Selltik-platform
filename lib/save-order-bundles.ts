import { bundleLineToOrderPayload } from "./order-draft-helpers";
import type { OrderDraftBundle, OrderDraftPreview } from "./types";

export type OrderDraftSaveItem = {
  id?: string;
  bundle: OrderDraftBundle;
  label?: string;
};

export type SaveOrderDraftBundlesResult =
  | {
      ok: true;
      savedLines: number;
      failedLines: number;
      bundleCount: number;
      fullySavedBundleIndices: number[];
      savedQueueIds: string[];
      errors: { bundleIndex: number; error: string; label: string }[];
      message: string;
    }
  | { ok: false; error: string };

type FlatPayload = {
  bundleIndex: number;
  label: string;
  payload: OrderDraftPreview;
};

function flattenBundles(items: OrderDraftSaveItem[]): FlatPayload[] {
  const flat: FlatPayload[] = [];
  for (let bundleIndex = 0; bundleIndex < items.length; bundleIndex++) {
    const { bundle, label } = items[bundleIndex];
    for (const line of bundle.lines) {
      flat.push({
        bundleIndex,
        label: label?.trim() || line.productName.trim() || "발주",
        payload: bundleLineToOrderPayload(bundle, line),
      });
    }
  }
  return flat;
}

export function formatBulkSaveMessage(created: number, failed: number): string {
  if (failed === 0) {
    return `${created}건 임시 발주서에 저장되었습니다.`;
  }
  return `${created}건 저장됨 · ${failed}건 실패`;
}

export async function saveOrderDraftBundles(
  items: OrderDraftSaveItem[]
): Promise<SaveOrderDraftBundlesResult> {
  if (items.length === 0) {
    return { ok: false, error: "저장할 발주가 없습니다." };
  }

  for (const item of items) {
    const invalid = item.bundle.lines.filter((l) => !l.productName?.trim());
    if (invalid.length > 0) {
      return {
        ok: false,
        error: `${item.label || "발주"}: 모든 상품명을 확인해 주세요.`,
      };
    }
  }

  const flat = flattenBundles(items);
  if (flat.length === 0) {
    return { ok: false, error: "저장할 발주가 없습니다." };
  }

  const res = await fetch("/api/seller/orders/bulk-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orders: flat.map((entry) => entry.payload) }),
  });
  const data = (await res.json()) as {
    error?: string;
    created?: number;
    errors?: { index: number; error: string }[];
  };

  if (!res.ok && !data.created) {
    return { ok: false, error: data.error || "저장에 실패했습니다." };
  }

  const created = data.created ?? 0;
  const apiErrors = data.errors ?? [];
  const failedLines = apiErrors.length;

  const failedLinesPerBundle = new Map<number, number>();
  const totalLinesPerBundle = new Map<number, number>();
  for (const entry of flat) {
    totalLinesPerBundle.set(
      entry.bundleIndex,
      (totalLinesPerBundle.get(entry.bundleIndex) ?? 0) + 1
    );
  }
  for (const apiError of apiErrors) {
    const bundleIndex = flat[apiError.index]?.bundleIndex;
    if (bundleIndex === undefined) continue;
    failedLinesPerBundle.set(
      bundleIndex,
      (failedLinesPerBundle.get(bundleIndex) ?? 0) + 1
    );
  }

  const fullySavedBundleIndices: number[] = [];
  for (const [bundleIndex, total] of totalLinesPerBundle) {
    const failed = failedLinesPerBundle.get(bundleIndex) ?? 0;
    if (failed === 0) fullySavedBundleIndices.push(bundleIndex);
  }

  const savedQueueIds = fullySavedBundleIndices
    .map((index) => items[index]?.id)
    .filter((id): id is string => !!id);

  const errors = apiErrors
    .map((apiError) => {
      const entry = flat[apiError.index];
      if (!entry) return null;
      return {
        bundleIndex: entry.bundleIndex,
        error: apiError.error,
        label: entry.label,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  let message = formatBulkSaveMessage(created, failedLines);
  const failedBundleCount = items.length - fullySavedBundleIndices.length;
  if (failedLines > 0 && failedBundleCount > 0) {
    message += ` (${failedBundleCount}통은 목록에 남김)`;
  }

  return {
    ok: true,
    savedLines: created,
    failedLines,
    bundleCount: items.length,
    fullySavedBundleIndices,
    savedQueueIds,
    errors,
    message,
  };
}
