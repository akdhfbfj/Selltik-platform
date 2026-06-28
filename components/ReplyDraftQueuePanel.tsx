"use client";

import OrderDraftTableEditor from "@/components/OrderDraftTableEditor";
import { formatKrw } from "@/lib/parse-supply-csv";
import type { QueuedReplyDraft, SellerProductView } from "@/lib/types";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";

interface Props {
  queue: QueuedReplyDraft[];
  products: SellerProductView[];
  onToggleSelect: (id: string, selected: boolean) => void;
  onToggleAll: (selected: boolean) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, draft: QueuedReplyDraft) => void;
}

export default function ReplyDraftQueuePanel({
  queue,
  products,
  onToggleSelect,
  onToggleAll,
  onRemove,
  onUpdate,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (queue.length === 0) return null;

  const selectedCount = queue.filter((q) => q.selected).length;
  const allSelected = selectedCount === queue.length;

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
              3
            </span>
            저장 목록
          </h3>
          <p className="mt-0.5 ml-8 text-xs text-slate-500">
            {queue.length}건 누적 · 선택 {selectedCount}건
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onToggleAll(e.target.checked)}
            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          전체 선택
        </label>
      </div>

      <ul className="space-y-2">
        {queue.map((item, index) => {
          const expanded = expandedId === item.id;
          const lineTotal = item.bundle.lines.reduce(
            (sum, l) => sum + l.supplyTotal,
            0
          );

          return (
            <li
              key={item.id}
              className="rounded-xl border border-slate-200 bg-slate-50/60"
            >
              <div className="flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={(e) => onToggleSelect(item.id, e.target.checked)}
                  className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  aria-label={`${item.label} 선택`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-medium text-slate-400">
                      #{index + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-slate-900">
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {item.bundle.address || "주소 없음"}
                    {item.bundle.postalCode
                      ? ` · ${item.bundle.postalCode}`
                      : ""}
                    {item.bundle.contactPhone
                      ? ` · ${item.bundle.contactPhone}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-slate-600">
                    상품 {item.bundle.lines.length}건 · 합계{" "}
                    <strong className="text-slate-800">
                      {formatKrw(lineTotal)}
                    </strong>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expanded ? null : item.id)
                    }
                    className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-800"
                    aria-label={expanded ? "접기" : "펼치기"}
                  >
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600"
                    aria-label="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-slate-200 bg-white p-3">
                  <OrderDraftTableEditor
                    bundle={item.bundle}
                    products={products}
                    onChange={(bundle) =>
                      onUpdate(item.id, {
                        ...item,
                        bundle,
                        label: item.label,
                      })
                    }
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
