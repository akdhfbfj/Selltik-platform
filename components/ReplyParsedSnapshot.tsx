"use client";

import type { OrderDraftBundle } from "@/lib/types";

interface Props {
  bundle: OrderDraftBundle | null;
  loading?: boolean;
}

function meaningfulLines(bundle: OrderDraftBundle) {
  return bundle.lines.filter((line) => {
    const name = line.productName.trim();
    if (!name) return false;
    if (/^\d{1,2}:\d{2}/.test(name)) return false;
    if (/LTE|^\|[\s¢]|^all\s/i.test(name)) return false;
    if (name.length < 2) return false;
    if (!/[가-힣]/.test(name) && name.length < 4) return false;
    return true;
  });
}

export default function ReplyParsedSnapshot({ bundle, loading }: Props) {
  if (loading) {
    return (
      <div className="flex h-full min-h-[200px] flex-col rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
        <p className="text-xs font-semibold text-slate-600">
          분석에서 읽은 값 (원문)
        </p>
        <p className="mt-4 flex flex-1 items-center justify-center text-sm text-slate-400">
          분석 중…
        </p>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex h-full min-h-[200px] flex-col rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
        <p className="text-xs font-semibold text-slate-600">
          분석에서 읽은 값 (원문)
        </p>
        <p className="mt-4 flex flex-1 items-center justify-center text-center text-xs leading-relaxed text-slate-400">
          붙여넣기·분석하면
          <br />
          추출된 이름·주소·상품이
          <br />
          바로 여기에 표시됩니다
        </p>
      </div>
    );
  }

  const lines = meaningfulLines(bundle);
  const who =
    bundle.recipientName.replace(/님$/, "") ||
    bundle.ordererName.replace(/님$/, "") ||
    "—";

  return (
    <div className="flex h-full min-h-[200px] flex-col rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="mb-3 text-xs font-semibold text-slate-600">
        분석에서 읽은 값 (원문)
      </p>
      <dl className="space-y-3 text-xs">
        <div>
          <dt className="text-slate-400">수령인</dt>
          <dd className="mt-0.5 font-medium text-slate-800">
            {who}
            {bundle.contactPhone ? (
              <span className="font-normal text-slate-600">
                {" "}
                · {bundle.contactPhone}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">주소</dt>
          <dd className="mt-0.5 break-all text-slate-800">
            {bundle.postalCode ? `[${bundle.postalCode}] ` : ""}
            {bundle.address || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">상품</dt>
          <dd className="mt-1 space-y-1.5">
            {lines.length > 0 ? (
              lines.map((line) => (
                <div
                  key={line.id}
                  className="rounded-lg border border-white bg-white px-2.5 py-2 text-slate-800 shadow-sm"
                >
                  {line.productName}
                  {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                </div>
              ))
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
