import { bundleLineToOrderPayload } from "./order-draft-helpers";
import type { OrderDraftBundle } from "./types";

export async function saveOrderDraftBundles(
  bundles: OrderDraftBundle[]
): Promise<
  | { ok: true; savedLines: number; bundleCount: number }
  | { ok: false; error: string }
> {
  if (bundles.length === 0) {
    return { ok: false, error: "저장할 발주가 없습니다." };
  }

  let savedLines = 0;
  for (const bundle of bundles) {
    const invalid = bundle.lines.filter((l) => !l.productName?.trim());
    if (invalid.length > 0) {
      return { ok: false, error: "모든 상품명을 확인해 주세요." };
    }
    for (const line of bundle.lines) {
      const res = await fetch("/api/seller/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundleLineToOrderPayload(bundle, line)),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          error:
            (data.error as string) ||
            `${line.productName || "상품"} 저장에 실패했습니다.`,
        };
      }
      savedLines++;
    }
  }

  return { ok: true, savedLines, bundleCount: bundles.length };
}
