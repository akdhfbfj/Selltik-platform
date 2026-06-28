import type { OrderDraftBundle, QueuedReplyDraft } from "./types";

const LEGACY_DRAFT_KEY = "selltik_pending_order_draft";
const PENDING_DRAFTS_KEY = "selltik_pending_order_drafts";
const REPLY_QUEUE_KEY = "selltik_reply_draft_queue";

export function savePendingOrderDrafts(bundles: OrderDraftBundle[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_DRAFTS_KEY, JSON.stringify(bundles));
}

export function loadPendingOrderDrafts(): OrderDraftBundle[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(PENDING_DRAFTS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as OrderDraftBundle[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  const legacy = sessionStorage.getItem(LEGACY_DRAFT_KEY);
  if (legacy) {
    try {
      const one = JSON.parse(legacy) as OrderDraftBundle;
      return one ? [one] : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function clearPendingOrderDrafts(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_DRAFTS_KEY);
  sessionStorage.removeItem(LEGACY_DRAFT_KEY);
}

/** @deprecated 단일 건 — savePendingOrderDrafts([bundle]) 사용 */
export function savePendingOrderDraft(bundle: OrderDraftBundle): void {
  savePendingOrderDrafts([bundle]);
}

/** @deprecated 단일 건 — loadPendingOrderDrafts()[0] 사용 */
export function loadPendingOrderDraft(): OrderDraftBundle | null {
  return loadPendingOrderDrafts()[0] ?? null;
}

/** @deprecated clearPendingOrderDrafts() 사용 */
export function clearPendingOrderDraft(): void {
  clearPendingOrderDrafts();
}

export function loadReplyDraftQueue(): QueuedReplyDraft[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(REPLY_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedReplyDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReplyDraftQueue(queue: QueuedReplyDraft[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(REPLY_QUEUE_KEY, JSON.stringify(queue));
}

export function clearReplyDraftQueue(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(REPLY_QUEUE_KEY);
}
