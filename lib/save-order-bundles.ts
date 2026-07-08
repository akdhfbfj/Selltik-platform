import { bundleLineToOrderPayload } from "./order-draft-helpers";
import type { OrderDraftBundle, OrderDraftPreview } from "./types";

/** chunk당 최대 품목 줄 수 (Vercel 10초 타임아웃 회피) */
export const SAVE_CHUNK_MAX_LINES = 40;

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

export type SaveOrderDraftBundlesOptions = {
  onProgress?: (current: number, total: number) => void;
};

type FlatPayload = {
  bundleIndex: number;
  label: string;
  payload: OrderDraftPreview;
};

type BulkCreateResponse = {
  error?: string;
  created?: number;
  errors?: { index: number; error: string }[];
};

function flattenBundles(
  items: OrderDraftSaveItem[],
  bundleIndexOffset = 0
): FlatPayload[] {
  const flat: FlatPayload[] = [];
  for (let localIndex = 0; localIndex < items.length; localIndex++) {
    const { bundle, label } = items[localIndex];
    const bundleIndex = bundleIndexOffset + localIndex;
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

/** 통(번들) 단위로 자르고, chunk당 품목 줄 수 상한을 넘지 않게 묶음 */
export function chunkSaveItems(
  items: OrderDraftSaveItem[],
  maxLinesPerChunk: number = SAVE_CHUNK_MAX_LINES
): OrderDraftSaveItem[][] {
  const chunks: OrderDraftSaveItem[][] = [];
  let current: OrderDraftSaveItem[] = [];
  let currentLineCount = 0;

  for (const item of items) {
    const lineCount = item.bundle.lines.length;
    if (current.length > 0 && currentLineCount + lineCount > maxLinesPerChunk) {
      chunks.push(current);
      current = [];
      currentLineCount = 0;
    }
    current.push(item);
    currentLineCount += lineCount;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export function chunkPayloads<T>(
  payloads: T[],
  maxPerChunk: number = SAVE_CHUNK_MAX_LINES
): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < payloads.length; i += maxPerChunk) {
    chunks.push(payloads.slice(i, i + maxPerChunk));
  }
  return chunks;
}

export function formatBulkSaveMessage(created: number, failed: number): string {
  if (failed === 0) {
    return `${created}건 임시 발주서에 저장되었습니다.`;
  }
  return `${created}건 저장됨 · ${failed}건 실패`;
}

async function postBulkCreateChunk(
  payloads: OrderDraftPreview[]
): Promise<{
  created: number;
  errors: { index: number; error: string }[];
  fatalError?: string;
}> {
  try {
    const res = await fetch("/api/seller/orders/bulk-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders: payloads }),
    });

    let data: BulkCreateResponse = {};
    try {
      data = (await res.json()) as BulkCreateResponse;
    } catch {
      return {
        created: 0,
        errors: [],
        fatalError:
          "서버 응답을 읽지 못했습니다. 발주 탭에서 저장된 건수를 확인해 주세요.",
      };
    }

    if (!res.ok && !data.created) {
      return {
        created: data.created ?? 0,
        errors: data.errors ?? [],
        fatalError: data.error || "저장에 실패했습니다.",
      };
    }

    return {
      created: data.created ?? 0,
      errors: data.errors ?? [],
    };
  } catch {
    return {
      created: 0,
      errors: [],
      fatalError: "네트워크 오류가 발생했습니다.",
    };
  }
}

function aggregateBundleResults(
  items: OrderDraftSaveItem[],
  flat: FlatPayload[],
  created: number,
  apiErrors: { flatIndex: number; error: string }[]
): SaveOrderDraftBundlesResult {
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
    const bundleIndex = flat[apiError.flatIndex]?.bundleIndex;
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
      const entry = flat[apiError.flatIndex];
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

export async function saveOrderDraftBundles(
  items: OrderDraftSaveItem[],
  options?: SaveOrderDraftBundlesOptions
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

  const itemChunks = chunkSaveItems(items);
  let created = 0;
  const apiErrors: { flatIndex: number; error: string }[] = [];
  let bundleIndexOffset = 0;
  let flatOffset = 0;

  for (let chunkIndex = 0; chunkIndex < itemChunks.length; chunkIndex++) {
    options?.onProgress?.(chunkIndex + 1, itemChunks.length);

    const chunkItems = itemChunks[chunkIndex];
    const chunkFlat = flattenBundles(chunkItems, bundleIndexOffset);
    const result = await postBulkCreateChunk(
      chunkFlat.map((entry) => entry.payload)
    );

    created += result.created;

    for (const apiError of result.errors) {
      apiErrors.push({
        flatIndex: flatOffset + apiError.index,
        error: apiError.error,
      });
    }

    if (result.fatalError && result.created === 0 && result.errors.length === 0) {
      for (let i = 0; i < chunkFlat.length; i++) {
        apiErrors.push({
          flatIndex: flatOffset + i,
          error: result.fatalError,
        });
      }
    }

    bundleIndexOffset += chunkItems.length;
    flatOffset += chunkFlat.length;
  }

  if (created === 0 && apiErrors.length > 0) {
    return {
      ok: false,
      error: apiErrors[0]?.error || "저장에 실패했습니다.",
    };
  }

  return aggregateBundleResults(items, flat, created, apiErrors);
}

/** SMS/XML 등 flat payload 일괄 저장 (chunk 분할) */
export async function saveOrderPayloadsInChunks(
  payloads: OrderDraftPreview[],
  options?: SaveOrderDraftBundlesOptions
): Promise<{ created: number; failed: number; message: string }> {
  if (payloads.length === 0) {
    return { created: 0, failed: 0, message: "저장할 발주가 없습니다." };
  }

  const payloadChunks = chunkPayloads(payloads);
  let created = 0;
  let failed = 0;

  for (let chunkIndex = 0; chunkIndex < payloadChunks.length; chunkIndex++) {
    options?.onProgress?.(chunkIndex + 1, payloadChunks.length);

    const chunk = payloadChunks[chunkIndex];
    const result = await postBulkCreateChunk(chunk);

    created += result.created;

    if (result.errors.length > 0) {
      failed += result.errors.length;
    } else if (
      result.fatalError &&
      result.created === 0 &&
      result.errors.length === 0
    ) {
      failed += chunk.length;
    }
  }

  return {
    created,
    failed,
    message: formatBulkSaveMessage(created, failed),
  };
}
